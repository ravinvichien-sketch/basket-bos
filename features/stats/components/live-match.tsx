"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  startMatchGame,
  toggleMatchTimer,
  endMatchGame,
  recordMatchEvent,
  undoMatchEvent,
  subtractPoints,
  saveMatchMinutes,
} from "../actions";
import {
  swapPlayers,
  assignPlayerToTeam,
  removePlayerFromTeam,
  substitutePlayer,
} from "@/features/teams/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function playClick() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.06);
  } catch {}
}

export interface LivePlayer {
  profileId: string;
  nickname: string;
  avatarUrl: string | null;
}

export interface LiveTeam {
  id: string;
  name: string;
  color: string;
  members: LivePlayer[];
}

type EventKey =
  | "make2" | "make3" | "makeFt" | "miss" | "miss3"
  | "ast" | "reb_off" | "reb_def" | "stl" | "blk" | "tov";

type GameState = "idle" | "playing" | "finished";
type UserRole = "admin" | "statKeeper" | "viewer";

const POINT_MODES: { key: EventKey; label: string }[] = [
  { key: "make2", label: "+2 แต้ม" },
  { key: "make3", label: "+3 แต้ม" },
  { key: "makeFt", label: "ฟรีโธรว์ +1" },
  { key: "miss", label: "2 พลาด" },
  { key: "miss3", label: "3 พลาด" },
];

const STAT_CHIPS: { key: EventKey; label: string }[] = [
  { key: "reb_off", label: "รีบรุก" },
  { key: "reb_def", label: "รีบรับ" },
  { key: "ast", label: "แอส" },
  { key: "stl", label: "สตีล" },
  { key: "blk", label: "บล็อก" },
  { key: "tov", label: "เสีย" },
];

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LiveMatch({
  gameId,
  teams,
  gameDurationMinutes,
  targetScore,
  existingMatches,
  userId,
  userRole,
  sessionPlayers = [],
}: {
  gameId: string;
  teams: LiveTeam[];
  gameDurationMinutes: number;
  targetScore: number | null;
  existingMatches: { id: string; status: string }[];
  userId: string;
  userRole: UserRole;
  sessionPlayers?: LivePlayer[];
}) {
  const router = useRouter();
  const supabase = createClient();

  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? "");
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? "");
  const [currentMatchId, setCurrentMatchId] = useState<string | null>(null);
  const [gameState, setGameState] = useState<GameState>("idle");
  const [timerSeconds, setTimerSeconds] = useState(gameDurationMinutes * 60);
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerStartedAt, setTimerStartedAt] = useState<string | null>(null);
  const [mode, setMode] = useState<EventKey>("make2");
  const [flash, setFlash] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [gameNumber] = useState(
    existingMatches.filter((m) => m.status === "finished").length + 1
  );
  const [matchName, setMatchName] = useState<string | null>(null);
  const [selectedSwapId, setSelectedSwapId] = useState<string | null>(null);
  const [substitutingFor, setSubstitutingFor] = useState<{ playerId: string; teamId: string } | null>(null);
  const [eventHistory, setEventHistory] = useState<{ playerId: string; ev: EventKey }[]>([]);
  const [redoHistory, setRedoHistory] = useState<{ playerId: string; ev: EventKey }[]>([]);
  const [dbStats, setDbStats] = useState<
    Record<string, Record<string, number>>
  >({});
  const [guestPoints, setGuestPoints] = useState<Record<string, number>>({});
  const [playerMinutes, setPlayerMinutes] = useState<Record<string, number>>({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const minutesRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timerEndRef = useRef<number | null>(null);

  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);
  const sameTeam = teamAId === teamBId;
  const allTeamMemberIds = new Set(
    teams.flatMap((t) => t.members.map((m) => m.profileId))
  );
  const unassignedPlayers = sessionPlayers.filter(
    (sp) => !allTeamMemberIds.has(sp.profileId)
  );

  const canControl = userRole === "admin";
  const canRecord = userRole === "admin" || userRole === "statKeeper";
  const gamePaused = gameState === "playing" && !timerRunning;

  // Score from DB stats + our local contribution
  const scoreA = teamA
    ? teamA.members.reduce(
        (s, m) => s + (dbStats[m.profileId]?.points ?? 0),
        0
      ) + (guestPoints[teamA.id] ?? 0)
    : 0;
  const scoreB = teamB
    ? teamB.members.reduce(
        (s, m) => s + (dbStats[m.profileId]?.points ?? 0),
        0
      ) + (guestPoints[teamB.id] ?? 0)
    : 0;

  // ── On mount: pick up active match if admin already started one ──
  useEffect(() => {
    const active = existingMatches.find((m) => m.status === "playing");
    if (active) {
      setCurrentMatchId(active.id);
      setGameState("playing");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load initial DB stats for current match ──
  useEffect(() => {
    if (!currentMatchId) {
      setDbStats({});
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("player_game_stats")
        .select("profile_id, points, assists, reb_off, reb_def, steals, blocks, turnovers, fouls")
        .eq("match_id", currentMatchId);
      if (data) {
        const m: Record<string, Record<string, number>> = {};
        for (const r of data) {
          m[r.profile_id] = {
            points: r.points,
            assists: r.assists,
            reb_off: r.reb_off,
            reb_def: r.reb_def,
            steals: r.steals,
            blocks: r.blocks,
            turnovers: r.turnovers,
            fouls: r.fouls,
          };
        }
        setDbStats(m);
      }
    };
    load();
  }, [currentMatchId, supabase]);

  // ── Realtime: listen for stat changes for this match ──
  useEffect(() => {
    if (!currentMatchId) return;
    const channel = supabase
      .channel(`match-stats-${currentMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "player_game_stats",
          filter: `match_id=eq.${currentMatchId}`,
        },
        () => {
          supabase
            .from("player_game_stats")
            .select("profile_id, points, assists, reb_off, reb_def, steals, blocks, turnovers, fouls")
            .eq("match_id", currentMatchId)
            .then(({ data }) => {
              if (data) {
                const m: Record<string, Record<string, number>> = {};
                for (const r of data) {
                  m[r.profile_id] = {
                    points: r.points,
                    assists: r.assists,
                    reb_off: r.reb_off,
                    reb_def: r.reb_def,
                    steals: r.steals,
                    blocks: r.blocks,
                    turnovers: r.turnovers,
                    fouls: r.fouls,
                  };
                }
                setDbStats(m);
              }
            });
        }
      )
      .subscribe();
    subRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [currentMatchId, supabase]);

  // ── Realtime: sync match status ──
  useEffect(() => {
    const channel = supabase
      .channel(`match-status-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "matches",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const m = payload.new as { id: string; status: string };
          if (m.status === "playing") {
            setCurrentMatchId(m.id);
            setGameState("playing");
            setTimerRunning(true);
            setTimerStartedAt(new Date().toISOString());
            setTimerSeconds(gameDurationMinutes * 60);
            setDbStats({});
            setGuestPoints({});
            setMessage(null);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `game_id=eq.${gameId}`,
        },
        (payload) => {
          const m = payload.new as { id: string; status: string };
          if (m.status === "finished" || m.status === "completed") {
            setGameState("finished");
            setTimerRunning(false);
            setMessage("⏰ เกมส์จบแล้ว");
          } else if (m.status === "playing") {
            setGameState("playing");
          }
        }
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [gameId, gameDurationMinutes, supabase]);

  // ── Client-side timer tick ──
  useEffect(() => {
    if (timerRunning && timerStartedAt) {
      const started = new Date(timerStartedAt).getTime();
      const durationMs = timerSeconds * 1000;
      timerEndRef.current = started + durationMs;

      const id = setInterval(() => {
        const remaining = Math.max(
          0,
          Math.round((timerEndRef.current! - Date.now()) / 1000)
        );
        setTimerSeconds(remaining);
        if (remaining <= 0) {
          setTimerRunning(false);
          setMessage("⏰ หมดเวลา! กดจบเกมส์เพื่อยืนยัน");
          clearInterval(id);
        }
      }, 200);
      timerRef.current = id;
    } else {
      timerEndRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerStartedAt]);

  // ── Track per-player minutes while timer runs ──
  const activePlayerIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    activePlayerIdsRef.current = new Set(
      teams.flatMap((t) => t.members.map((m) => m.profileId))
    );
  }, [teams]);

  useEffect(() => {
    if (timerRunning && gameState === "playing") {
      const id = setInterval(() => {
        setPlayerMinutes((prev) => {
          const next = { ...prev };
          for (const pid of activePlayerIdsRef.current) {
            next[pid] = (next[pid] ?? 0) + 1;
          }
          return next;
        });
      }, 1000);
      minutesRef.current = id;
    } else {
      if (minutesRef.current) clearInterval(minutesRef.current);
    }
    return () => {
      if (minutesRef.current) clearInterval(minutesRef.current);
    };
  }, [timerRunning, gameState]);

  // ── Realtime subscription for timer state ──
  useEffect(() => {
    if (!currentMatchId) return;
    const channel = supabase
      .channel(`match-timer-${currentMatchId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "matches",
          filter: `id=eq.${currentMatchId}`,
        },
        (payload: {
          new: {
            timer_running: boolean;
            timer_seconds: number;
            timer_started_at: string | null;
            status: string;
          };
        }) => {
          const n = payload.new;
          setTimerRunning(n.timer_running);
          if (n.timer_running && n.timer_started_at) {
            setTimerStartedAt(n.timer_started_at);
            setTimerSeconds(n.timer_seconds);
          } else {
            setTimerSeconds(n.timer_seconds);
            setTimerStartedAt(null);
          }
          if (n.status === "finished") {
            setGameState("finished");
            setTimerRunning(false);
          }
        }
      )
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [currentMatchId, supabase]);

  // ── Auto-stop on target score ──
  useEffect(() => {
    if (
      targetScore &&
      gameState === "playing" &&
      canRecord &&
      (scoreA >= targetScore || scoreB >= targetScore)
    ) {
      setTimerRunning(false);
      setGameState("finished");
      setMessage(`🎯 ถึง ${targetScore} แต้ม! เกมส์จบ`);
      if (currentMatchId) {
        startTransition(async () => {
          await saveMatchMinutes(currentMatchId, gameId, playerMinutes);
          await toggleMatchTimer(currentMatchId, timerSeconds, false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreA, scoreB]);

  function changeTeams(next: (v: string) => void, value: string, other: string) {
    if (gameState === "playing") return;
    if (value === other) return;
    next(value);
    setMessage(null);
    setDbStats({});
  }

  function handleRecord(playerId: string, ev: EventKey) {
    if (!canRecord || !currentMatchId || gameState !== "playing") return;
    setFlash(playerId + ev);
    setTimeout(() => setFlash(null), 220);
    playClick();

    // Optimistic local update so score/stats show immediately
    setDbStats((prev) => {
      const cur: Record<string, number> = prev[playerId] ?? {};
      const updated: Record<string, number> = { ...cur };
      if (ev === "make2") updated.points = (cur.points ?? 0) + 2;
      if (ev === "make3") updated.points = (cur.points ?? 0) + 3;
      if (ev === "makeFt") updated.points = (cur.points ?? 0) + 1;
      if (ev === "reb_off") updated.reb_off = (cur.reb_off ?? 0) + 1;
      if (ev === "reb_def") updated.reb_def = (cur.reb_def ?? 0) + 1;
      if (ev === "ast") updated.assists = (cur.assists ?? 0) + 1;
      if (ev === "stl") updated.steals = (cur.steals ?? 0) + 1;
      if (ev === "blk") updated.blocks = (cur.blocks ?? 0) + 1;
      if (ev === "tov") updated.turnovers = (cur.turnovers ?? 0) + 1;
      return { ...prev, [playerId]: updated };
    });

    startTransition(async () => {
      const res = await recordMatchEvent(currentMatchId, gameId, playerId, ev);
      if (res.error) setMessage(res.error);
      else {
        setEventHistory((prev) => [...prev.slice(-4), { playerId, ev }]);
        setRedoHistory([]);
      }
    });
  }

  function handleUndo() {
    if (eventHistory.length === 0 || !currentMatchId) return;
    const evt = eventHistory[eventHistory.length - 1];
    setEventHistory((prev) => prev.slice(0, -1));
    setRedoHistory((prev) => [...prev, evt]);
    const { playerId, ev } = evt;

    // Revert optimistic update
    setDbStats((prev) => {
      const cur: Record<string, number> = prev[playerId] ?? {};
      const updated: Record<string, number> = { ...cur };
      if (ev === "make2") updated.points = Math.max(0, (cur.points ?? 0) - 2);
      if (ev === "make3") updated.points = Math.max(0, (cur.points ?? 0) - 3);
      if (ev === "makeFt") updated.points = Math.max(0, (cur.points ?? 0) - 1);
      if (ev === "reb_off") updated.reb_off = Math.max(0, (cur.reb_off ?? 0) - 1);
      if (ev === "reb_def") updated.reb_def = Math.max(0, (cur.reb_def ?? 0) - 1);
      if (ev === "ast") updated.assists = Math.max(0, (cur.assists ?? 0) - 1);
      if (ev === "stl") updated.steals = Math.max(0, (cur.steals ?? 0) - 1);
      if (ev === "blk") updated.blocks = Math.max(0, (cur.blocks ?? 0) - 1);
      if (ev === "tov") updated.turnovers = Math.max(0, (cur.turnovers ?? 0) - 1);
      return { ...prev, [playerId]: updated };
    });

    startTransition(async () => {
      const res = await undoMatchEvent(currentMatchId, gameId, playerId, ev);
      if (res.error) {
        setMessage(res.error);
        // Re-re-record the event optimistically (failed undo)
        setDbStats((prev) => {
          const cur: Record<string, number> = prev[playerId] ?? {};
          const updated: Record<string, number> = { ...cur };
          if (ev === "make2") updated.points = (cur.points ?? 0) + 2;
          if (ev === "make3") updated.points = (cur.points ?? 0) + 3;
          if (ev === "makeFt") updated.points = (cur.points ?? 0) + 1;
          if (ev === "reb_off") updated.reb_off = (cur.reb_off ?? 0) + 1;
          if (ev === "reb_def") updated.reb_def = (cur.reb_def ?? 0) + 1;
          if (ev === "ast") updated.assists = (cur.assists ?? 0) + 1;
          if (ev === "stl") updated.steals = (cur.steals ?? 0) + 1;
          if (ev === "blk") updated.blocks = (cur.blocks ?? 0) + 1;
          if (ev === "tov") updated.turnovers = (cur.turnovers ?? 0) + 1;
          return { ...prev, [playerId]: updated };
        });
      }
    });
  }

  function handleRedo() {
    if (redoHistory.length === 0 || !currentMatchId) return;
    const evt = redoHistory[redoHistory.length - 1];
    setRedoHistory((prev) => prev.slice(0, -1));
    const { playerId, ev } = evt;

    // Optimistic redo: increment
    setDbStats((prev) => {
      const cur: Record<string, number> = prev[playerId] ?? {};
      const updated: Record<string, number> = { ...cur };
      if (ev === "make2") updated.points = (cur.points ?? 0) + 2;
      if (ev === "make3") updated.points = (cur.points ?? 0) + 3;
      if (ev === "makeFt") updated.points = (cur.points ?? 0) + 1;
      if (ev === "reb_off") updated.reb_off = (cur.reb_off ?? 0) + 1;
      if (ev === "reb_def") updated.reb_def = (cur.reb_def ?? 0) + 1;
      if (ev === "ast") updated.assists = (cur.assists ?? 0) + 1;
      if (ev === "stl") updated.steals = (cur.steals ?? 0) + 1;
      if (ev === "blk") updated.blocks = (cur.blocks ?? 0) + 1;
      if (ev === "tov") updated.turnovers = (cur.turnovers ?? 0) + 1;
      return { ...prev, [playerId]: updated };
    });

    startTransition(async () => {
      const res = await recordMatchEvent(currentMatchId, gameId, playerId, ev);
      if (res.error) {
        setMessage(res.error);
        setDbStats((prev) => {
          const cur: Record<string, number> = prev[playerId] ?? {};
          const updated: Record<string, number> = { ...cur };
          if (ev === "make2") updated.points = Math.max(0, (cur.points ?? 0) - 2);
          if (ev === "make3") updated.points = Math.max(0, (cur.points ?? 0) - 3);
          if (ev === "makeFt") updated.points = Math.max(0, (cur.points ?? 0) - 1);
          if (ev === "reb_off") updated.reb_off = Math.max(0, (cur.reb_off ?? 0) - 1);
          if (ev === "reb_def") updated.reb_def = Math.max(0, (cur.reb_def ?? 0) - 1);
          if (ev === "ast") updated.assists = Math.max(0, (cur.assists ?? 0) - 1);
          if (ev === "stl") updated.steals = Math.max(0, (cur.steals ?? 0) - 1);
          if (ev === "blk") updated.blocks = Math.max(0, (cur.blocks ?? 0) - 1);
          if (ev === "tov") updated.turnovers = Math.max(0, (cur.turnovers ?? 0) - 1);
          return { ...prev, [playerId]: updated };
        });
      } else {
        setEventHistory((prev) => [...prev.slice(-4), { playerId, ev }]);
      }
    });
  }

  function handleSubtract(playerId: string, amount: number) {
    if (!canRecord || !currentMatchId) return;
    setFlash(playerId + "sub");
    setTimeout(() => setFlash(null), 220);
    playClick();

    setDbStats((prev) => {
      const cur: Record<string, number> = prev[playerId] ?? {};
      return { ...prev, [playerId]: { ...cur, points: Math.max(0, (cur.points ?? 0) - amount) } };
    });

    startTransition(async () => {
      const res = await subtractPoints(currentMatchId, gameId, playerId, amount);
      if (res.error) {
        setMessage(res.error);
        setDbStats((prev) => {
          const cur: Record<string, number> = prev[playerId] ?? {};
          return { ...prev, [playerId]: { ...cur, points: (cur.points ?? 0) + amount } };
        });
      }
    });
  }

  function handleGuestScore(teamId: string) {
    if (!canRecord || !currentMatchId) return;
    const pts = mode === "make2" ? 2 : mode === "make3" ? 3 : mode === "makeFt" ? 1 : 0;
    if (pts === 0) return;
    playClick();
    setGuestPoints((prev) => ({ ...prev, [teamId]: (prev[teamId] ?? 0) + pts }));
  }

  function handleTeamSwap(playerId: string) {
    if (gameState !== "idle" || !canControl) return;
    if (!selectedSwapId) {
      setSelectedSwapId(playerId);
      return;
    }
    if (selectedSwapId === playerId) {
      setSelectedSwapId(null);
      return;
    }
    const id1 = selectedSwapId;
    setSelectedSwapId(null);

    const isId1Unassigned = unassignedPlayers.some((p) => p.profileId === id1);
    const isId2Unassigned = unassignedPlayers.some((p) => p.profileId === playerId);

    // ถ้าผู้เล่นหนึ่งในสองคนยังไม่ได้อยู่ในทีม → เอาคนเก่าออก ใส่คนใหม่แทน
    if (isId1Unassigned && isId2Unassigned) {
      setMessage("ผู้เล่นทั้งสองยังไม่อยู่ในทีม");
      return;
    }
    if (isId1Unassigned) {
      const team = teams.find((t) => t.members.some((m) => m.profileId === playerId));
      if (!team) { setMessage("ไม่พบทีม"); return; }
      startTransition(async () => {
        const res = await substitutePlayer(gameId, playerId, id1, team.id);
        if (res?.error) setMessage(res.error);
        else router.refresh();
      });
      return;
    }
    if (isId2Unassigned) {
      const team = teams.find((t) => t.members.some((m) => m.profileId === id1));
      if (!team) { setMessage("ไม่พบทีม"); return; }
      startTransition(async () => {
        const res = await substitutePlayer(gameId, id1, playerId, team.id);
        if (res?.error) setMessage(res.error);
        else router.refresh();
      });
      return;
    }

    // ปกติ: สลับผู้เล่นข้ามทีม
    startTransition(async () => {
      const res = await swapPlayers(gameId, id1, playerId);
      if (res?.error) setMessage(res.error);
      else router.refresh();
    });
  }

  function handleMovePlayer(playerId: string, targetTeamId: string) {
    if (gameState !== "idle" || !canControl) return;
    setSelectedSwapId(null);
    startTransition(async () => {
      const res = await assignPlayerToTeam(gameId, playerId, targetTeamId);
      if (res?.error) setMessage(res.error);
      else router.refresh();
    });
  }

  function handleRemoveFromTeam(playerId: string) {
    if (gameState !== "idle" || !canControl) {
      setMessage("ไม่สามารถนำออกได้ตอนนี้");
      return;
    }
    setSelectedSwapId(null);
    setMessage("กำลังนำออก...");
    startTransition(async () => {
      try {
        const res = await removePlayerFromTeam(gameId, playerId);
        if (res?.error) {
          setMessage("❗ " + res.error);
        } else {
          setMessage("✓ นำออกแล้ว");
          setTimeout(() => window.location.reload(), 300);
        }
      } catch (e) {
        setMessage("❗ เกิดข้อผิดพลาด: " + (e instanceof Error ? e.message : "unknown"));
      }
    });
  }

  function handleSubstitute(newPlayerId: string) {
    if (!substitutingFor || !canControl) return;
    const { playerId: oldPlayerId, teamId } = substitutingFor;
    setSubstitutingFor(null);
    startTransition(async () => {
      const res = await substitutePlayer(gameId, oldPlayerId, newPlayerId, teamId);
      if (res?.error) setMessage(res.error);
      else {
        setMessage(`เปลี่ยนตัว ✓`);
        router.refresh();
      }
    });
  }

  function handleStartGame() {
    if (sameTeam || !teamA || !teamB) {
      setMessage("เลือกทีมให้ครบ 2 ทีม (คนละทีม)");
      return;
    }
    startTransition(async () => {
      const res = await startMatchGame(gameId, teamAId, teamBId);
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setCurrentMatchId(res.matchId!);
      setMatchName(res.matchName ?? null);
      setGameState("playing");
      setTimerRunning(true);
      setTimerStartedAt(new Date().toISOString());
      setTimerSeconds(gameDurationMinutes * 60);
      setDbStats({});
      setGuestPoints({});
      setPlayerMinutes({});
      setMessage(null);
    });
  }

  function handlePauseResume() {
    if (!currentMatchId) return;
    const nextRunning = !timerRunning;
    startTransition(async () => {
      await toggleMatchTimer(currentMatchId, timerSeconds, nextRunning);
      if (nextRunning) {
        setTimerStartedAt(new Date().toISOString());
        setTimerRunning(true);
      } else {
        setTimerRunning(false);
        setTimerStartedAt(null);
      }
    });
  }

  function handleEndGame() {
    if (!currentMatchId || !teamA || !teamB) return;
    startTransition(async () => {
      // Save accumulated minutes first
      await saveMatchMinutes(currentMatchId, gameId, playerMinutes);
      // For multi-recorder mode, don't batch save deltas — stats are already in DB
      const res = await endMatchGame(
        currentMatchId,
        gameId,
        JSON.stringify({
          team_a: teamAId,
          team_b: teamBId,
          score_a: scoreA,
          score_b: scoreB,
          lines: [], // Stats already recorded via recordMatchEvent
        })
      );
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setGameState("finished");
      setTimerRunning(false);
      setMessage(`จบเกมส์ ${scoreA}-${scoreB} ✓`);
      router.refresh();
    });
  }

  function handleNewGame() {
    setCurrentMatchId(null);
    setMatchName(null);
    setGameState("idle");
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerSeconds(gameDurationMinutes * 60);
    setDbStats({});
    setGuestPoints({});
    setPlayerMinutes({});
    setMessage(null);
  }

  function formatMinutes(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  function playerCard(m: LivePlayer, team: LiveTeam) {
    const stats = dbStats[m.profileId];
    const pts = stats?.points ?? 0;
    const ast = stats?.assists ?? 0;
    const reb_off = stats?.reb_off ?? 0;
    const reb_def = stats?.reb_def ?? 0;
    const stl = stats?.steals ?? 0;
    const blk = stats?.blocks ?? 0;
    const tov = stats?.turnovers ?? 0;
    const mins = playerMinutes[m.profileId] ?? 0;

    return (
      <div
        key={m.profileId}
        className={cn(
          "rounded-xl border p-2 transition",
          gameState !== "playing" && "opacity-60",
          flash?.startsWith(m.profileId)
            ? flash.endsWith("sub")
              ? "border-red-500/40 bg-red-500/10"
              : "border-court bg-court/20"
            : "border-white/10 bg-surface-raised"
        )}
      >
        <button
          type="button"
          onClick={() => handleRecord(m.profileId, mode)}
          disabled={!canRecord || gameState !== "playing"}
          className="flex w-full items-center gap-2 text-left active:scale-[0.98] transition disabled:opacity-40"
        >
          {m.avatarUrl ? (
            <Image
              src={m.avatarUrl}
              alt=""
              width={26}
              height={26}
              className="rounded-full shrink-0"
            />
          ) : (
            <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-surface-overlay flex items-center justify-center text-[11px]">
              🏀
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-xs font-semibold">
            {m.nickname}
          </span>
          {gameState === "playing" && (
            <span className="text-[10px] text-ink-faint tabular-nums mr-1">
              {formatMinutes(mins)}
            </span>
          )}
          <span
            className="font-display text-base font-bold tabular-nums"
            style={{ color: team.color }}
          >
            {pts}
          </span>
        </button>
        {canRecord && gameState === "playing" && (
          <div className="mt-1 flex gap-1">
            {[1, 2, 3].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => handleSubtract(m.profileId, amt)}
                className="flex-1 rounded-md border border-red-500/20 bg-red-500/5 py-1 text-center text-[10px] font-semibold text-red-400 transition active:scale-95"
              >
                −{amt}
              </button>
            ))}
          </div>
        )}
        <div className="mt-1.5 flex gap-1">
          {STAT_CHIPS.map((c) => {
            const val =
              c.key === "reb_off"
                ? reb_off
                : c.key === "reb_def"
                  ? reb_def
                  : c.key === "ast"
                  ? ast
                  : c.key === "stl"
                    ? stl
                    : c.key === "blk"
                      ? blk
                      : tov;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => handleRecord(m.profileId, c.key as EventKey)}
                disabled={!canRecord || gameState !== "playing"}
                className={cn(
                  "flex-1 rounded-md border py-1 text-center transition active:scale-95 disabled:opacity-40",
                  val > 0
                    ? "border-court/40 bg-court/10 text-court"
                    : "border-white/10 bg-surface-overlay text-ink-dim"
                )}
              >
                <span className="block text-[9px] leading-none">{c.label}</span>
                <span className="block text-[11px] font-bold tabular-nums leading-tight">
                  {val}
                </span>
              </button>
            );
          })}
        </div>
        {canControl && gamePaused && (
          <div className="mt-1.5">
            {substitutingFor?.playerId === m.profileId ? (
              <div className="space-y-1">
                {sessionPlayers.length > 0 ? (
                  sessionPlayers.map((sp) => (
                    <button
                      key={sp.profileId}
                      type="button"
                      onClick={() => handleSubstitute(sp.profileId)}
                      disabled={isPending}
                      className="w-full flex items-center gap-1.5 rounded-md bg-court/20 px-2 py-1 text-[11px] font-semibold text-court hover:bg-court/30 transition disabled:opacity-50"
                    >
                      {sp.avatarUrl ? (
                        <Image src={sp.avatarUrl} alt="" width={14} height={14} className="rounded-full" />
                      ) : (
                        <span className="h-[14px] w-[14px] rounded-full bg-surface-overlay flex items-center justify-center text-[8px]">🏀</span>
                      )}
                      <span className="truncate">{sp.nickname}</span>
                    </button>
                  ))
                ) : (
                  <p className="text-[10px] text-ink-faint text-center py-1">ไม่มีตัวสำรอง</p>
                )}
                <button
                  type="button"
                  onClick={() => setSubstitutingFor(null)}
                  className="w-full rounded-md bg-surface-overlay text-[10px] py-1 text-ink-faint hover:text-ink transition"
                >
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setSubstitutingFor({ playerId: m.profileId, teamId: team.id })}
                disabled={isPending}
                className="w-full rounded-md bg-amber-500/15 text-amber-400 text-[10px] py-1 font-semibold hover:bg-amber-500/25 transition disabled:opacity-50"
              >
                เปลี่ยนตัว
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {matchName ?? `เกมส์ที่ ${gameNumber}`}
        </h2>
        <Link
          href={`/games/${gameId}/summary`}
          className="text-xs text-ink-faint hover:text-court transition"
        >
          สรุปทั้ง Session →
        </Link>
      </div>

      {/* Team selectors */}
      <div className="flex items-center gap-2">
        <select
          value={teamAId}
          onChange={(e) => changeTeams(setTeamAId, e.target.value, teamBId)}
          disabled={gameState !== "idle"}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          style={teamA ? { borderColor: teamA.color, color: teamA.color } : undefined}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === teamBId}>
              {t.name} {t.id === teamBId ? "(ถูกเลือกแล้ว)" : ""}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">vs</span>
        <select
          value={teamBId}
          onChange={(e) => changeTeams(setTeamBId, e.target.value, teamAId)}
          disabled={gameState !== "idle"}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          style={teamB ? { borderColor: teamB.color, color: teamB.color } : undefined}
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id} disabled={t.id === teamAId}>
              {t.name} {t.id === teamAId ? "(ถูกเลือกแล้ว)" : ""}
            </option>
          ))}
        </select>
      </div>

      {sameTeam && gameState === "idle" && (
        <p className="rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3 text-center">
          เลือกทีมซ้ำกันอยู่ — เปลี่ยนฝั่งใดฝั่งหนึ่งก่อนครับ
        </p>
      )}

      {/* Team roster editing (pre-match only) */}
      {gameState === "idle" && canControl && teamAId && teamBId && (
        <div className="rounded-xl2 bg-surface-raised border border-white/5 p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-ink-dim">
              จัดผู้เล่นก่อนเริ่ม
            </h3>
            {selectedSwapId && (
              <button
                type="button"
                onClick={() => setSelectedSwapId(null)}
                className="text-[11px] text-court hover:underline"
              >
                ยกเลิก
              </button>
            )}
          </div>
          {selectedSwapId && (
            <p className="text-[10px] text-ink-faint text-center">
              เลือกอีกคนเพื่อสลับ หรือกด นำออก / + ย้าย
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            {[teamA, teamB].map((t) =>
              t ? (
                <div key={t.id}>
                  <p
                    className="text-[11px] font-bold mb-1"
                    style={{ color: t.color }}
                  >
                    {t.name}
                  </p>
                  <div className="space-y-1">
                    {t.members.map((m) => (
                      <div key={m.profileId} className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedSwapId) {
                              handleTeamSwap(m.profileId);
                            } else {
                              setSelectedSwapId(m.profileId);
                            }
                          }}
                          className={cn(
                            "flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition",
                            selectedSwapId === m.profileId
                              ? "bg-court/30 ring-1 ring-court"
                              : "bg-surface-overlay hover:bg-surface-overlay/70"
                          )}
                        >
                          {m.avatarUrl && (
                            <Image
                              src={m.avatarUrl}
                              alt=""
                              width={18}
                              height={18}
                              className="rounded-full"
                            />
                          )}
                          <span className="truncate">{m.nickname}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromTeam(m.profileId)}
                          disabled={isPending}
                          className="shrink-0 rounded-lg bg-red-500/10 px-1.5 text-[10px] text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
                          title="นำออกจากทีม"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    {t.members.length === 0 && (
                      <p className="text-[11px] text-ink-faint text-center py-2">
                        ไม่มีผู้เล่น
                      </p>
                    )}
                  </div>
                  {/* Move selected player to this team */}
                  {selectedSwapId &&
                    !t.members.some((m) => m.profileId === selectedSwapId) && (
                      <button
                        type="button"
                        onClick={() => handleMovePlayer(selectedSwapId, t.id)}
                        className="mt-1 w-full rounded-lg bg-court/20 text-court text-[11px] py-1.5 font-semibold hover:bg-court/30 transition"
                      >
                        + ย้ายมาที่นี่
                      </button>
                    )}
                </div>
              ) : null
            )}
          </div>
          {/* Unassigned players in pre-game editing */}
          {unassignedPlayers.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-ink-dim mb-1">ผู้เล่นอื่น ๆ</p>
              <div className="grid grid-cols-2 gap-1">
                {unassignedPlayers.map((m) => (
                   <div key={m.profileId} className="flex gap-1">
                     <button
                       type="button"
                       onClick={() => {
                          if (selectedSwapId) {
                            handleTeamSwap(m.profileId);
                          } else {
                            setSelectedSwapId(m.profileId);
                          }
                        }}
                       className={cn(
                         "flex-1 flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs transition",
                         selectedSwapId === m.profileId
                           ? "bg-court/30 ring-1 ring-court"
                           : "bg-surface-overlay hover:bg-surface-overlay/70"
                       )}
                     >
                       {m.avatarUrl && (
                         <Image src={m.avatarUrl} alt="" width={18} height={18} className="rounded-full" />
                       )}
                       <span className="truncate">{m.nickname}</span>
                     </button>
                    {teamA && (
                      <button
                        type="button"
                        onClick={() => handleMovePlayer(m.profileId, teamA.id)}
                        disabled={isPending}
                        className="shrink-0 rounded-lg bg-court/20 px-2 text-[10px] text-court font-semibold hover:bg-court/30 transition disabled:opacity-50"
                        style={teamA ? { color: teamA.color } : undefined}
                      >
                        {teamA.name[0]}
                      </button>
                    )}
                    {teamB && (
                      <button
                        type="button"
                        onClick={() => handleMovePlayer(m.profileId, teamB.id)}
                        disabled={isPending}
                        className="shrink-0 rounded-lg bg-court/20 px-2 text-[10px] text-court font-semibold hover:bg-court/30 transition disabled:opacity-50"
                        style={teamB ? { color: teamB.color } : undefined}
                      >
                        {teamB.name[0]}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Timer + Scoreboard */}
      <div className="rounded-xl2 bg-surface-raised border border-white/5 px-4 py-4">
        {/* Timer */}
        <div className="text-center mb-3">
          <div
            className={cn(
              "font-display text-5xl font-bold tabular-nums",
              timerSeconds <= 30 && gameState === "playing"
                ? "text-red-400"
                : "text-ink"
            )}
          >
            {formatTime(timerSeconds)}
          </div>
          <div className="flex items-center justify-center gap-2 mt-1">
            {gameState === "idle" && canControl && (
              <Button
                onClick={handleStartGame}
                disabled={isPending || sameTeam || !teamAId || !teamBId}
                size="md"
              >
                {isPending ? "..." : "▶ เริ่มเกมส์"}
              </Button>
            )}
            {gameState === "playing" && canControl && (
              <>
                {timerSeconds > 0 && (
                  <button
                    onClick={handlePauseResume}
                    disabled={isPending}
                    className="h-10 w-10 rounded-full bg-surface-overlay flex items-center justify-center hover:bg-surface-overlay/70 transition disabled:opacity-50"
                  >
                    {timerRunning ? "⏸" : "▶"}
                  </button>
                )}
                <Button
                  onClick={handleEndGame}
                  disabled={isPending}
                  size="md"
                  variant={timerSeconds <= 0 ? "danger" : "secondary"}
                  className={timerSeconds <= 0 ? "animate-pulse" : ""}
                >
                  {isPending ? "..." : timerSeconds <= 0 ? "⏹ ยืนยันจบเกมส์" : "⏹ จบเกมส์"}
                </Button>
              </>
            )}
            {gameState === "playing" && !canControl && (
              <span className="rounded-xl bg-amber-500/10 text-amber-400 px-4 py-2 text-xs">
                {timerSeconds <= 0 ? "⏰ หมดเวลา! รอแอดมินยืนยัน" : "รอแอดมินจบเกมส์"}
              </span>
            )}
            {gameState === "finished" && (
              <div className="flex flex-wrap gap-2 justify-center">
                {canControl && (
                  <Button onClick={handleNewGame} size="md">
                    ▶ เริ่มเกมส์ถัดไป
                  </Button>
                )}
                {canControl && (
                  <Link
                    href={`/games/${gameId}/teams`}
                    className="inline-flex h-10 items-center rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
                  >
                    ⚖️ จัดทีมใหม่
                  </Link>
                )}
                <Link
                  href={`/games/${gameId}/summary`}
                  className="inline-flex h-10 items-center rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
                >
                  📊 สรุป Session
                </Link>
              </div>
            )}
          </div>
          {targetScore && (
            <p className="text-[11px] text-ink-faint mt-1">
              เป้าหมาย {targetScore} แต้ม · อะไรถึงก่อนจบเกมส์
            </p>
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex items-center justify-center gap-6 pt-2 border-t border-white/5">
          <div className="flex-1 text-center">
            <p
              className="text-xs font-bold truncate"
              style={{ color: teamA?.color }}
            >
              {teamA?.name ?? "-"}
            </p>
            <p
              className="font-display text-5xl font-bold tabular-nums leading-tight"
              style={{ color: teamA?.color }}
            >
              {scoreA}
            </p>
          </div>
          <span className="text-ink-faint text-lg">–</span>
          <div className="flex-1 text-center">
            <p
              className="text-xs font-bold truncate"
              style={{ color: teamB?.color }}
            >
              {teamB?.name ?? "-"}
            </p>
            <p
              className="font-display text-5xl font-bold tabular-nums leading-tight"
              style={{ color: teamB?.color }}
            >
              {scoreB}
            </p>
          </div>
        </div>
      </div>

      {/* Role indicator */}
      {!canControl && canRecord && (
        <p className="text-center text-[11px] text-ink-faint">
          คุณเป็นผู้ช่วยจดสถิติ — กดที่ผู้เล่นเพื่อบันทึกเหตุการณ์
        </p>
      )}

      {/* Point modes */}
      <div className="rounded-xl2 bg-surface-raised border border-white/5 p-3 space-y-2">
        <div className="grid grid-cols-5 gap-1.5">
          {POINT_MODES.map((pm) => (
            <button
              key={pm.key}
              type="button"
              onClick={() => setMode(pm.key)}
              className={cn(
                "h-11 rounded-xl text-xs font-bold transition active:scale-95",
                mode === pm.key
                  ? "bg-court text-white"
                  : "bg-surface-overlay text-ink-dim hover:text-ink",
                gameState !== "playing" && "opacity-40"
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] text-ink-faint">
          {canRecord
            ? `เลือกแต้มด้านบน แล้วแตะที่ผู้เล่นที่ทำ — สถิติอื่นกดปุ่มบนตัวได้เลย`
            : `รอแอดมินเริ่มเกมส์เพื่อบันทึกสถิติ`}
        </p>
        {canRecord && (
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={handleUndo}
              disabled={eventHistory.length === 0 || isPending}
              className={cn(
                "flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-30",
                eventHistory.length > 0
                  ? "bg-red-500/10 text-red-400 hover:bg-red-500/20"
                  : "bg-surface-overlay text-ink-faint"
              )}
            >
              ↩️ เลิกทำ ({eventHistory.length}/5)
            </button>
            <button
              onClick={handleRedo}
              disabled={redoHistory.length === 0 || isPending}
              className={cn(
                "flex items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:opacity-30",
                redoHistory.length > 0
                  ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-surface-overlay text-ink-faint"
              )}
            >
              ↩️ ทำซ้ำ ({redoHistory.length})
            </button>
          </div>
        )}
      </div>

      {/* Players by team */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-center" style={{ color: teamA?.color }}>
            {teamA?.name ?? "ทีม A"}
          </h3>
          {teamA?.members.map((m) => playerCard(m, teamA))}
          {teamA?.members.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-faint">
              ทีมนี้ยังไม่มีผู้เล่น
            </p>
          )}
          {/* Guest card for each team during play */}
          {canRecord && gameState === "playing" && teamA && (
            <button
              type="button"
              onClick={() => handleGuestScore(teamA.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/5 p-3 transition active:scale-[0.98]",
                mode === "miss" || mode === "miss3" ? "opacity-40" : "hover:border-white/30"
              )}
            >
              <span className="text-xs font-semibold text-ink-dim">👤 เสริม</span>
              <span className="font-display text-base font-bold tabular-nums" style={{ color: teamA.color }}>
                {guestPoints[teamA.id] ?? 0}
              </span>
            </button>
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-center" style={{ color: teamB?.color }}>
            {teamB?.name ?? "ทีม B"}
          </h3>
          {teamB?.members.map((m) => playerCard(m, teamB))}
          {teamB?.members.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-faint">
              ทีมนี้ยังไม่มีผู้เล่น
            </p>
          )}
          {/* Guest card for each team during play */}
          {canRecord && gameState === "playing" && teamB && (
            <button
              type="button"
              onClick={() => handleGuestScore(teamB.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-xl border border-dashed border-white/20 bg-white/5 p-3 transition active:scale-[0.98]",
                mode === "miss" || mode === "miss3" ? "opacity-40" : "hover:border-white/30"
              )}
            >
              <span className="text-xs font-semibold text-ink-dim">👤 เสริม</span>
              <span className="font-display text-base font-bold tabular-nums" style={{ color: teamB.color }}>
                {guestPoints[teamB.id] ?? 0}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Unassigned players pool (for stat recording + pre-game assignment) */}
      {unassignedPlayers.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-center text-ink-dim">
            ผู้เล่นอื่น ๆ
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {unassignedPlayers.map((m) => (
              <div
                key={m.profileId}
                className={cn(
                  "rounded-xl border p-2 transition",
                  gameState !== "playing" && "opacity-60",
                  flash?.startsWith(m.profileId)
                    ? flash.endsWith("sub")
                      ? "border-red-500/40 bg-red-500/10"
                      : "border-court bg-court/20"
                    : "border-white/10 bg-surface-raised"
                )}
              >
                <button
                  type="button"
                  onClick={() => handleRecord(m.profileId, mode)}
                  disabled={!canRecord || gameState !== "playing"}
                  className="flex w-full items-center gap-2 text-left active:scale-[0.98] transition disabled:opacity-40"
                >
                  {m.avatarUrl ? (
                    <Image src={m.avatarUrl} alt="" width={26} height={26} className="rounded-full shrink-0" />
                  ) : (
                    <span className="h-[26px] w-[26px] shrink-0 rounded-full bg-surface-overlay flex items-center justify-center text-[11px]">🏀</span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">{m.nickname}</span>
                  <span className="font-display text-base font-bold tabular-nums text-ink-dim">
                    {dbStats[m.profileId]?.points ?? 0}
                  </span>
                </button>
                {canRecord && gameState === "playing" && (
                  <div className="mt-1 flex gap-1">
                    {[1, 2, 3].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => handleSubtract(m.profileId, amt)}
                        className="flex-1 rounded-md border border-red-500/20 bg-red-500/5 py-1 text-center text-[10px] font-semibold text-red-400 transition active:scale-95"
                      >
                        −{amt}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-1.5 flex gap-1">
                  {STAT_CHIPS.map((c) => {
                    const s = dbStats[m.profileId] ?? {};
                    const val = c.key === "reb_off" ? (s.reb_off ?? 0)
                      : c.key === "reb_def" ? (s.reb_def ?? 0)
                      : c.key === "ast" ? (s.assists ?? 0)
                      : c.key === "stl" ? (s.steals ?? 0)
                      : c.key === "blk" ? (s.blocks ?? 0)
                      : (s.turnovers ?? 0);
                    return (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => handleRecord(m.profileId, c.key as EventKey)}
                        disabled={!canRecord || gameState !== "playing"}
                        className={cn(
                          "flex-1 rounded-md border py-1 text-center transition active:scale-95 disabled:opacity-40",
                          val > 0
                            ? "border-court/40 bg-court/10 text-court"
                            : "border-white/10 bg-surface-overlay text-ink-dim"
                        )}
                      >
                        <span className="block text-[9px] leading-none">{c.label}</span>
                        <span className="block text-[11px] font-bold tabular-nums leading-tight">{val}</span>
                      </button>
                    );
                  })}
                </div>
                {/* Assign to team (pre-game only) */}
                {canControl && gameState === "idle" && (
                  <div className="mt-1.5 flex gap-1">
                    {teamA && (
                      <button
                        type="button"
                        onClick={() => handleMovePlayer(m.profileId, teamA.id)}
                        disabled={isPending}
                        className="flex-1 rounded-md bg-court/20 text-court text-[10px] py-1 font-semibold hover:bg-court/30 transition disabled:opacity-50"
                      >
                        → {teamA.name}
                      </button>
                    )}
                    {teamB && (
                      <button
                        type="button"
                        onClick={() => handleMovePlayer(m.profileId, teamB.id)}
                        disabled={isPending}
                        className="flex-1 rounded-md bg-court/20 text-court text-[10px] py-1 font-semibold hover:bg-court/30 transition disabled:opacity-50"
                      >
                        → {teamB.name}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {message && (
        <p
          className={cn(
            "rounded-xl px-4 py-3 text-sm text-center",
            message.includes("✓") || message.includes("จบ") || message.includes("🎯") || message.includes("⏰")
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-red-500/10 text-red-400"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
