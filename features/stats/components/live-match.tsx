"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveLiveMatch } from "../actions";
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

interface Delta {
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  assists: number;
  reb_off: number;
  reb_def: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

const EMPTY: Delta = {
  fgm: 0,
  fga: 0,
  tpm: 0,
  tpa: 0,
  ftm: 0,
  fta: 0,
  assists: 0,
  reb_off: 0,
  reb_def: 0,
  steals: 0,
  blocks: 0,
  turnovers: 0,
  fouls: 0,
};

type EventKey =
  | "make2"
  | "make3"
  | "makeFt"
  | "miss"
  | "ast"
  | "reb"
  | "stl"
  | "blk"
  | "tov";

// โหมดแต้ม (เลือกก่อน แล้วแตะผู้เล่นที่ทำ)
const POINT_MODES: { key: EventKey; label: string }[] = [
  { key: "make2", label: "+2 แต้ม" },
  { key: "make3", label: "+3 แต้ม" },
  { key: "makeFt", label: "ฟรีโธรว์ +1" },
  { key: "miss", label: "ยิงพลาด" },
];

// สถิติที่กดบนตัวผู้เล่นได้เลย
const STAT_CHIPS: { key: EventKey; label: string; field: keyof Delta }[] = [
  { key: "reb", label: "รีบ", field: "reb_def" },
  { key: "ast", label: "แอส", field: "assists" },
  { key: "stl", label: "สตีล", field: "steals" },
  { key: "blk", label: "บล็อก", field: "blocks" },
  { key: "tov", label: "เสีย", field: "turnovers" },
];

function apply(d: Delta, ev: EventKey): Delta {
  const s = { ...d };
  switch (ev) {
    case "make2":
      s.fgm++;
      s.fga++;
      break;
    case "make3":
      s.fgm++;
      s.fga++;
      s.tpm++;
      s.tpa++;
      break;
    case "makeFt":
      s.ftm++;
      s.fta++;
      break;
    case "miss":
      s.fga++;
      break;
    case "ast":
      s.assists++;
      break;
    case "reb":
      s.reb_def++;
      break;
    case "stl":
      s.steals++;
      break;
    case "blk":
      s.blocks++;
      break;
    case "tov":
      s.turnovers++;
      break;
  }
  return s;
}

const pointsOf = (d: Delta) => 2 * d.fgm + d.tpm + d.ftm;

export function LiveMatch({
  gameId,
  teams,
}: {
  gameId: string;
  teams: LiveTeam[];
}) {
  const router = useRouter();
  const [teamAId, setTeamAId] = useState(teams[0]?.id ?? "");
  const [teamBId, setTeamBId] = useState(teams[1]?.id ?? "");
  const [deltas, setDeltas] = useState<Record<string, Delta>>({});
  const [mode, setMode] = useState<EventKey>("make2");
  const [history, setHistory] = useState<Record<string, Delta>[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const teamA = teams.find((t) => t.id === teamAId);
  const teamB = teams.find((t) => t.id === teamBId);
  const sameTeam = teamAId === teamBId;

  const deltaOf = (id: string) => deltas[id] ?? EMPTY;
  const scoreOf = (team?: LiveTeam) =>
    team
      ? team.members.reduce((s, m) => s + pointsOf(deltaOf(m.profileId)), 0)
      : 0;
  const scoreA = scoreOf(teamA);
  const scoreB = scoreOf(teamB);

  function changeTeams(next: (v: string) => void, value: string) {
    next(value);
    setDeltas({});
    setHistory([]);
    setMessage(null);
  }

  function record(playerId: string, ev: EventKey) {
    setMessage(null);
    setHistory((h) => [...h.slice(-60), deltas]);
    setDeltas((d) => ({ ...d, [playerId]: apply(deltaOf(playerId), ev) }));
    setFlash(playerId + ev);
    setTimeout(() => setFlash(null), 220);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setDeltas(prev);
    setHistory((h) => h.slice(0, -1));
  }

  function save() {
    if (sameTeam || !teamA || !teamB) {
      setMessage("เลือกทีมให้ครบ 2 ทีม (คนละทีม)");
      return;
    }
    const ids = [...teamA.members, ...teamB.members].map((m) => m.profileId);
    const lines = ids
      .map((id) => ({ profile_id: id, ...deltaOf(id) }))
      .filter((l) =>
        Object.entries(l).some(([k, v]) => k !== "profile_id" && Number(v) > 0)
      );
    if (lines.length === 0 && scoreA === 0 && scoreB === 0) {
      setMessage("ยังไม่มีเหตุการณ์ให้บันทึก");
      return;
    }
    startTransition(async () => {
      const res = await saveLiveMatch(
        gameId,
        JSON.stringify({
          team_a: teamAId,
          team_b: teamBId,
          score_a: scoreA,
          score_b: scoreB,
          lines,
        })
      );
      if (res.error) {
        setMessage(res.error);
        return;
      }
      setDeltas({});
      setHistory([]);
      setMessage(`บันทึกแมตช์ ${scoreA}-${scoreB} แล้ว ✓ เลือกคู่ถัดไปได้เลย`);
      router.refresh();
    });
  }

  function playerCard(m: LivePlayer, team: LiveTeam) {
    const d = deltaOf(m.profileId);
    const pts = pointsOf(d);
    return (
      <div
        key={m.profileId}
        className={cn(
          "rounded-xl border p-2 transition",
          flash === m.profileId + mode
            ? "border-court bg-court/20"
            : "border-white/10 bg-surface-raised"
        )}
      >
        <button
          type="button"
          onClick={() => record(m.profileId, mode)}
          className="flex w-full items-center gap-2 text-left active:scale-[0.98] transition"
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
            const n = d[c.field];
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => record(m.profileId, c.key)}
                className={cn(
                  "flex-1 rounded-md border py-1 text-center transition active:scale-95",
                  n > 0
                    ? "border-court/40 bg-court/10 text-court"
                    : "border-white/10 bg-surface-overlay text-ink-dim"
                )}
              >
                <span className="block text-[9px] leading-none">{c.label}</span>
                <span className="block text-[11px] font-bold tabular-nums leading-tight">
                  {n}
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
      {/* เลือกคู่แข่ง */}
      <div className="flex items-center gap-2">
        <select
          value={teamAId}
          onChange={(e) => changeTeams(setTeamAId, e.target.value)}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court"
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
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        >
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>

      {sameTeam && (
        <p className="rounded-xl bg-amber-500/10 text-amber-400 text-sm px-4 py-3 text-center">
          เลือกทีมซ้ำกันอยู่ — เปลี่ยนฝั่งใดฝั่งหนึ่งก่อนครับ
        </p>
      )}

      {/* สกอร์บอร์ด */}
      <div className="rounded-xl2 bg-surface-raised border border-white/5 px-4 py-3">
        <div className="flex items-center justify-center gap-6">
          <div className="flex-1 text-center">
            <p className="text-xs font-bold truncate" style={{ color: teamA?.color }}>
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
            <p className="text-xs font-bold truncate" style={{ color: teamB?.color }}>
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

      {/* เลือกแต้ม แล้วแตะผู้เล่น */}
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
                  : "bg-surface-overlay text-ink-dim hover:text-ink"
              )}
            >
              {pm.label}
            </button>
          ))}
        </div>
        <p className="text-center text-[11px] text-ink-faint">
          เลือกแต้มด้านบน แล้ว<span className="text-court font-semibold">แตะที่ผู้เล่น</span>ที่ทำ · สถิติอื่นกดปุ่มบนตัวได้เลย
        </p>
        <p className="text-center text-[10px] text-ink-faint">
          💡 คะแนนทีมคิดจากแต้มผู้เล่นโดยอัตโนมัติ — ไม่ต้องกรอกแยก
        </p>
      </div>

      {/* ผู้เล่นสองฝั่ง */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {teamA?.members.map((m) => playerCard(m, teamA))}
          {teamA?.members.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-faint">ทีมนี้ยังไม่มีผู้เล่น</p>
          )}
        </div>
        <div className="space-y-2">
          {teamB?.members.map((m) => playerCard(m, teamB))}
          {teamB?.members.length === 0 && (
            <p className="py-4 text-center text-xs text-ink-faint">ทีมนี้ยังไม่มีผู้เล่น</p>
          )}
        </div>
      </div>

      {/* Undo + บันทึก */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={history.length === 0}
          className="h-12 flex-1 rounded-xl bg-surface-overlay text-sm text-ink-dim disabled:opacity-40"
        >
          ↩︎ ย้อนกลับ
        </button>
        <Button onClick={save} disabled={isPending || sameTeam} className="h-12 flex-[2]">
          {isPending ? "กำลังบันทึก..." : `จบเกม · บันทึก ${scoreA}-${scoreB} 🏆`}
        </Button>
      </div>

      {message && (
        <p
          className={cn(
            "rounded-xl px-4 py-3 text-sm text-center",
            message.includes("✓")
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
