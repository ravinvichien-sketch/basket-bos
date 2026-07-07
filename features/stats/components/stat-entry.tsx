"use client";

import Image from "next/image";
import { useMemo, useState, useTransition, useRef, useEffect } from "react";
import { saveGameStats } from "../actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface StatLine {
  minutes: number;
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
  is_mvp: boolean;
}

export interface StatPlayer {
  profileId: string;
  nickname: string;
  avatarUrl: string | null;
}

const EMPTY: StatLine = {
  minutes: 0,
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
  is_mvp: false,
};

type EventKey =
  | "make2"
  | "miss2"
  | "make3"
  | "miss3"
  | "makeFt"
  | "missFt"
  | "ast"
  | "reb"
  | "stl"
  | "blk"
  | "tov"
  | "foul";

const EVENTS: { key: EventKey; label: string; accent?: boolean }[] = [
  { key: "make2", label: "+2 ลง", accent: true },
  { key: "make3", label: "+3 ลง", accent: true },
  { key: "makeFt", label: "+1 FT", accent: true },
  { key: "miss2", label: "พลาด 2" },
  { key: "miss3", label: "พลาด 3" },
  { key: "missFt", label: "พลาด FT" },
  { key: "ast", label: "AST" },
  { key: "reb", label: "REB" },
  { key: "stl", label: "STL" },
  { key: "blk", label: "BLK" },
  { key: "tov", label: "TO" },
  { key: "foul", label: "FOUL" },
];

function apply(line: StatLine, ev: EventKey): StatLine {
  const s = { ...line };
  switch (ev) {
    case "make2":
      s.fgm++;
      s.fga++;
      break;
    case "miss2":
      s.fga++;
      break;
    case "make3":
      s.fgm++;
      s.fga++;
      s.tpm++;
      s.tpa++;
      break;
    case "miss3":
      s.fga++;
      s.tpa++;
      break;
    case "makeFt":
      s.ftm++;
      s.fta++;
      break;
    case "missFt":
      s.fta++;
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
    case "foul":
      s.fouls++;
      break;
  }
  return s;
}

export const pointsOf = (s: StatLine) => 2 * s.fgm + s.tpm + s.ftm;

export function StatEntry({
  gameId,
  players,
  initial,
}: {
  gameId: string;
  players: StatPlayer[];
  initial: Record<string, StatLine>;
}) {
  const [stats, setStats] = useState<Record<string, StatLine>>(() => {
    const map: Record<string, StatLine> = {};
    for (const p of players) map[p.profileId] = initial[p.profileId] ?? EMPTY;
    return map;
  });
  const [selected, setSelected] = useState<string | null>(
    players[0]?.profileId ?? null
  );
  const [search, setSearch] = useState("");
  const [history, setHistory] = useState<Record<string, StatLine>[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const line = selected ? stats[selected] : null;

  function record(ev: EventKey) {
    if (!selected) return;
    setHistory((h) => [...h.slice(-30), stats]);
    setStats((s) => ({ ...s, [selected]: apply(s[selected], ev) }));
    setMessage(null);
  }

  function undo() {
    const prev = history[history.length - 1];
    if (!prev) return;
    setStats(prev);
    setHistory((h) => h.slice(0, -1));
  }

  function toggleMvp(profileId: string) {
    setHistory((h) => [...h.slice(-30), stats]);
    setStats((s) => {
      const next: Record<string, StatLine> = {};
      for (const [pid, l] of Object.entries(s)) {
        next[pid] = {
          ...l,
          is_mvp: pid === profileId ? !l.is_mvp : false,
        };
      }
      return next;
    });
  }

  function setMinutes(profileId: string, minutes: number) {
    setStats((s) => ({
      ...s,
      [profileId]: { ...s[profileId], minutes: Math.max(0, minutes) },
    }));
  }

  function save() {
    startTransition(async () => {
      const payload = players.map((p) => ({
        profile_id: p.profileId,
        ...stats[p.profileId],
      }));
      const res = await saveGameStats(gameId, JSON.stringify(payload));
      setMessage(res.error ?? "บันทึกแล้ว ✓");
    });
  }

  const totals = useMemo(
    () =>
      players.reduce((sum, p) => sum + pointsOf(stats[p.profileId]), 0),
    [players, stats]
  );

  return (
    <div className="space-y-4">
      {/* player selector */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ค้นหาผู้เล่น..."
            className="h-10 w-full rounded-xl bg-surface-overlay border border-white/10 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
          {players
            .filter((p) => p.nickname.toLowerCase().includes(search.toLowerCase()))
            .map((p) => {
              const l = stats[p.profileId];
              return (
                <button
                  key={p.profileId}
                  type="button"
                  onClick={() => setSelected(p.profileId)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-2 py-1.5 transition text-left",
                    selected === p.profileId
                      ? "border-court bg-court/15"
                      : "border-white/10 bg-surface-raised hover:border-white/20"
                  )}
                >
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt=""
                      width={24}
                      height={24}
                      className="rounded-full shrink-0"
                    />
                  ) : (
                    <span className="h-6 w-6 shrink-0 rounded-full bg-surface-overlay flex items-center justify-center text-[10px]">
                      🏀
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-xs font-semibold">
                    {l.is_mvp && "⭐"}
                    {p.nickname}
                  </span>
                  <span className="font-display text-xs text-court font-bold tabular-nums shrink-0">
                    {pointsOf(l)} pts
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* event pad */}
      {line && selected && (
        <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">
              {players.find((p) => p.profileId === selected)?.nickname}
            </span>
            <span className="text-ink-dim tabular-nums">
              {pointsOf(line)} pts · {line.assists} ast ·{" "}
              {line.reb_off + line.reb_def} reb · {line.steals} stl · {line.blocks} blk
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {EVENTS.map((ev) => (
              <button
                key={ev.key}
                type="button"
                onClick={() => record(ev.key)}
                className={cn(
                  "h-12 rounded-xl text-sm font-bold transition active:scale-95",
                  ev.accent
                    ? "bg-court text-white"
                    : "bg-surface-overlay text-ink hover:bg-surface-overlay/70"
                )}
              >
                {ev.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-dim">
              นาที
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={line.minutes}
                onChange={(e) => setMinutes(selected, Number(e.target.value))}
                className="h-9 w-16 rounded-lg bg-surface-overlay border border-white/10 px-2 text-center text-sm"
              />
            </label>
            <button
              type="button"
              onClick={() => toggleMvp(selected)}
              className={cn(
                "h-9 rounded-lg px-3 text-sm font-semibold transition",
                line.is_mvp
                  ? "bg-amber-500/20 text-amber-400"
                  : "bg-surface-overlay text-ink-dim"
              )}
            >
              ⭐ MVP
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              className="ml-auto h-9 rounded-lg bg-surface-overlay px-3 text-sm text-ink-dim disabled:opacity-40"
            >
              ↩︎ Undo
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-ink-faint">
        <span>แต้มรวมทั้งเกม: {totals}</span>
        <span>{history.length > 0 && `${history.length} การแก้ไขที่ undo ได้`}</span>
      </div>

      <Button size="lg" onClick={save} disabled={isPending}>
        {isPending ? "กำลังบันทึก..." : "บันทึกสถิติทั้งหมด 💾"}
      </Button>

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
