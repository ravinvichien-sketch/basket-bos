"use client";

import { useState, useTransition } from "react";
import { updateOwnMatchStats } from "../actions";
import { cn } from "@/lib/utils";

interface MatchStat {
  matchId: string;
  matchLabel: string;
  profileId: string;
  points: number;
  minutes: number;
  fgm: number; fga: number;
  tpm: number; tpa: number;
  ftm: number; fta: number;
  assists: number;
  reb_off: number; reb_def: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
}

export function SelfStatsEditor({
  gameId,
  matchStats,
  isAdmin,
}: {
  gameId: string;
  matchStats: MatchStat[];
  isAdmin: boolean;
}) {
  const [stats, setStats] = useState<MatchStat[]>(matchStats);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (stats.length === 0) return null;

  const updateField = (idx: number, field: keyof MatchStat, val: number) => {
    setStats((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const save = (idx: number) => {
    const s = stats[idx];
    setMsg(null);
    start(async () => {
      const fd = new FormData();
      fd.set("match_id", s.matchId);
      fd.set("minutes", String(s.minutes));
      fd.set("fgm", String(s.fgm)); fd.set("fga", String(s.fga));
      fd.set("tpm", String(s.tpm)); fd.set("tpa", String(s.tpa));
      fd.set("ftm", String(s.ftm)); fd.set("fta", String(s.fta));
      fd.set("assists", String(s.assists));
      fd.set("reb_off", String(s.reb_off)); fd.set("reb_def", String(s.reb_def));
      fd.set("steals", String(s.steals));
      fd.set("blocks", String(s.blocks));
      fd.set("turnovers", String(s.turnovers));
      fd.set("fouls", String(s.fouls));
      if (isAdmin) fd.set("points", String(s.points));
      await updateOwnMatchStats(gameId, fd);
      setMsg("บันทึกแล้ว ✓");
    });
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-ink-dim">สถิติของฉัน — แก้ไขได้</h3>
      <p className="text-xs text-ink-faint">แต้มจะคงเดิม แก้ไขสถิติอื่นได้ (ยกเว้น admin)</p>
      {stats.map((s, i) => (
        <div key={s.matchId} className="rounded-xl bg-surface-overlay/50 p-3 space-y-2">
          <p className="text-xs font-semibold">แมตช์ {s.matchLabel}</p>
          <div className="grid grid-cols-4 gap-1.5">
            <Field label="นาที" value={s.minutes} onChange={(v) => updateField(i, "minutes", v)} />
            {isAdmin && <Field label="แต้ม" value={s.points} onChange={(v) => updateField(i, "points", v)} />}
            <Field label="2P" value={s.fgm} onChange={(v) => updateField(i, "fgm", v)} />
            <Field label="2PA" value={s.fga} onChange={(v) => updateField(i, "fga", v)} />
            <Field label="3P" value={s.tpm} onChange={(v) => updateField(i, "tpm", v)} />
            <Field label="3PA" value={s.tpa} onChange={(v) => updateField(i, "tpa", v)} />
            <Field label="FT" value={s.ftm} onChange={(v) => updateField(i, "ftm", v)} />
            <Field label="FTA" value={s.fta} onChange={(v) => updateField(i, "fta", v)} />
            <Field label="AST" value={s.assists} onChange={(v) => updateField(i, "assists", v)} />
            <Field label="REB" value={s.reb_off + s.reb_def} onChange={() => {}} disabled />
            <Field label="STL" value={s.steals} onChange={(v) => updateField(i, "steals", v)} />
            <Field label="BLK" value={s.blocks} onChange={(v) => updateField(i, "blocks", v)} />
            <Field label="TO" value={s.turnovers} onChange={(v) => updateField(i, "turnovers", v)} />
            <Field label="PF" value={s.fouls} onChange={(v) => updateField(i, "fouls", v)} />
          </div>
          <button
            onClick={() => save(i)}
            disabled={pending}
            className="w-full h-9 rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก..." : "บันทึกสถิติแมตช์นี้"}
          </button>
        </div>
      ))}
      {msg && (
        <p className="rounded-xl bg-emerald-500/10 text-emerald-400 px-4 py-2.5 text-sm text-center">{msg}</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="text-center">
      <span className="block text-[10px] text-ink-faint mb-0.5">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
        disabled={disabled}
        className="h-8 w-full rounded-lg bg-surface-overlay border border-white/10 text-center text-xs font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-40"
      />
    </label>
  );
}