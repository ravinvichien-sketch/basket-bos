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
} from "../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  | "make2" | "make3" | "makeFt" | "miss"
  | "ast" | "reb" | "stl" | "blk" | "tov";

type GameState = "idle" | "playing" | "finished";
type UserRole = "admin" | "statKeeper" | "viewer";

const POINT_MODES: { key: EventKey; label: string }[] = [
  { key: "make2", label: "+2 แต้ม" },
  { key: "make3", label: "+3 แต้ม" },
  { key: "makeFt", label: "ฟรีโธรว์ +1" },
  { key: "miss", label: "ยิงพลาด" },
];

const STAT_CHIPS: { key: EventKey; label: string }[] = [
  { key: "reb", label: "รีบ" },
  { key: "ast", label: "แอส" },
  { key: "stl", label: "สตีล" },
  { key: "blk", label: "บล็อก" },
  { key: "tov", label: "เสีย" },
];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function LiveMatch({
  gameId,
  teams,
  gameDurationMinutes,
  targetScore,
  existingMatches,
  userId,
  userRole,
}: {
  gameId: string;
  teams: LiveTeam[];
  gameDurationMinutes: number;
  targetScore: number | null;
  existingMatches: { id: string; status: string }[];
  userId: string;
  userRole: UserRole;
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
  const [dbStats, setDbStats] = useState<
    Record<string, { points: number; [key: string]: number }>
  >({});

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const subRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);
  const sameTeam = teamAId === teamBId;

  const canControl = userRole === "admin";
  const canRecord = userRole === "admin" || userRole === "statKeeper";

  // Score from DB stats + our local contribution
  const scoreA = teamA
    ? teamA.members.reduce(
        (s, m) => s + (dbStats[m.profileId]?.points ?? 0),
        0
      )
    : 0;
  const scoreB = teamB
    ? teamB.members.reduce(
        (s, m) => s + (dbStats[m.profileId]?.points ?? 0),
        0
      )
    : 0;

  // ── Load initial DB stats for current match ──
  useEffect(() => {
    if (!currentMatchId) {
      setDbStats({});
      return;
    }
    const load = async () => {
      const { data } = await supabase
        .from("player_game_stats")
        .select("profile_id, points, assists, reb_def, steals, blocks, turnovers, fouls")
        .eq("match_id", currentMatchId);
      if (data) {
        const m: Record<string, { points: number; [k: string]: number }> = {};
        for (const r of data) {
          m[r.profile_id] = {
            points: r.points,
            assists: r.assists,
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
            .select("profile_id, points, assists, reb_def, steals, blocks, turnovers, fouls")
            .eq("match_id", currentMatchId)
            .then(({ data }) => {
              if (data) {
                const m: Record<string, { points: number; [k: string]: number }> = {};
                for (const r of data) {
                  m[r.profile_id] = {
                    points: r.points,
                    assists: r.assists,
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

  // ── Client-side timer tick ──
  useEffect(() => {
    if (timerRunning && timerStartedAt) {
      const started = new Date(timerStartedAt).getTime();
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - started) / 1000);
        const remaining = Math.max(0, timerSeconds - elapsed);
        setTimerSeconds(remaining);
        if (remaining <= 0) {
          setTimerRunning(false);
          setGameState("finished");
          setMessage("⏰ หมดเวลา! เกมส์จบแล้ว");
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 100);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning, timerStartedAt, timerSeconds]);

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
          await toggleMatchTimer(currentMatchId, timerSeconds, false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scoreA, scoreB]);

  function changeTeams(next: (v: string) => void, value: string) {
    if (gameState === "playing") return;
    next(value);
    setMessage(null);
    setDbStats({});
  }

  function handleRecord(playerId: string, ev: EventKey) {
    if (!canRecord || !currentMatchId) return;
    setFlash(playerId + ev);
    setTimeout(() => setFlash(null), 220);
    startTransition(async () => {
      const res = await recordMatchEvent(currentMatchId, gameId, playerId, ev);
      if (res.error) setMessage(res.error);
      // DB stats will update via Realtime subscription
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
      setGameState("playing");
      setTimerRunning(true);
      setTimerStartedAt(new Date().toISOString());
      setTimerSeconds(gameDurationMinutes * 60);
      setDbStats({});
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
    setGameState("idle");
    setTimerRunning(false);
    setTimerStartedAt(null);
    setTimerSeconds(gameDurationMinutes * 60);
    setDbStats({});
    setMessage(null);
  }

  function playerCard(m: LivePlayer, team: LiveTeam) {
    const stats = dbStats[m.profileId];
    const pts = stats?.points ?? 0;
    const ast = stats?.assists ?? 0;
    const reb = stats?.reb_def ?? 0;
    const stl = stats?.steals ?? 0;
    const blk = stats?.blocks ?? 0;
    const tov = stats?.turnovers ?? 0;

    return (
      <div
        key={m.profileId}
        className={cn(
          "rounded-xl border p-2 transition",
          gameState !== "playing" && "opacity-60",
          flash === m.profileId + mode
            ? "border-court bg-court/20"
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
          <span
            className="font-display text-base font-bold tabular-nums"
            style={{ color: team.color }}
          >
            {pts}
          </span>
        </button>
        <div className="mt-1.5 flex gap-1">
          {STAT_CHIPS.map((c) => {
            const val =
              c.key === "reb"
                ? reb
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">เกมส์ที่ {gameNumber}</h2>
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
          onChange={(e) => changeTeams(setTeamAId, e.target.value)}
          disabled={gameState !== "idle"}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">vs</span>
        <select
          value={teamBId}
          onChange={(e) => changeTeams(setTeamBId, e.target.value)}
          disabled={gameState !== "idle"}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {sameTeam && gameState === "idle" && (
        <p className="rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3 text-center">
          เลือกทีมซ้ำกันอยู่ — เปลี่ยนฝั่งใดฝั่งหนึ่งก่อนครับ
        </p>
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
                <button
                  onClick={handlePauseResume}
                  disabled={isPending}
                  className="h-10 w-10 rounded-full bg-surface-overlay flex items-center justify-center hover:bg-surface-overlay/70 transition disabled:opacity-50"
                >
                  {timerRunning ? "⏸" : "▶"}
                </button>
                <Button
                  onClick={handleEndGame}
                  disabled={isPending}
                  size="md"
                  variant="danger"
                >
                  {isPending ? "..." : "⏹ จบเกมส์"}
                </Button>
              </>
            )}
            {gameState === "playing" && !canControl && (
              <span className="rounded-xl bg-amber-500/10 text-amber-400 px-4 py-2 text-xs">
                รอแอดมินจบเกมส์
              </span>
            )}
            {gameState === "finished" && (
              <div className="flex gap-2">
                {canControl && (
                  <Button onClick={handleNewGame} size="md">
                    ▶ เริ่มเกมส์ถัดไป
                  </Button>
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
        <div className="grid grid-cols-4 gap-1.5">
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
        </div>
      </div>

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
