import Image from "next/image";
import type { Tier } from "../lib/ratings";

export interface PlayerCardData {
  nickname: string;
  photoUrl: string | null;
  positions: string[];
  heightCm: number | null;
  weightKg: number | null;
  ovr: number;
  tier: Tier;
  gamesPlayed: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fgPct: number | null;
}

/** Big stat with superscript decimal — "20.1" → 20 big + .1 raised (NBA graphic style) */
function BigStat({
  value,
  label,
  accent,
}: {
  value: string;
  label: string;
  accent: string;
}) {
  const [intPart, decPart] = value.split(".");
  return (
    <div className="flex flex-col items-center">
      <p className="font-display leading-none">
        <span className="text-[34px] font-bold tabular-nums tracking-tight">
          {intPart}
        </span>
        {decPart !== undefined && (
          <span
            className="align-super text-sm font-black"
            style={{ color: accent }}
          >
            .{decPart}
          </span>
        )}
      </p>
      <p className="mt-1 text-[9px] font-bold tracking-[0.25em] opacity-60">
        {label}
      </p>
    </div>
  );
}

/**
 * In-app trading card — NBA poster language (docs/05-DESIGN-REFERENCE):
 * giant numerals, name overlapping the hero, vertical side text, texture layers.
 */
export function PlayerCard({ data }: { data: PlayerCardData }) {
  const { tier } = data;
  return (
    <div
      className="card-shine relative overflow-hidden rounded-2xl text-white"
      style={{ background: tier.gradient }}
    >
      {/* halftone texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1.5px)",
          backgroundSize: "12px 12px",
        }}
      />
      {/* corner glow */}
      <div
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full blur-3xl opacity-30"
        style={{ background: tier.accent }}
      />

      {/* vertical side text */}
      <p
        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 -rotate-180 text-[8px] font-bold tracking-[0.35em] opacity-40"
        style={{ writingMode: "vertical-rl" }}
      >
        BASKET BOS · SEASON 2026 · {tier.label}
      </p>

      <div className="relative px-5 pt-4 pb-5 pl-8">
        {/* header: tier + OVR */}
        <div className="flex items-start justify-between">
          <div className="mt-1">
            <span
              className="rounded px-2 py-0.5 text-[9px] font-black tracking-[0.2em]"
              style={{ backgroundColor: `${tier.accent}26`, color: tier.accent }}
            >
              {tier.label} · {tier.thai}
            </span>
          </div>
          <div className="text-right leading-none">
            <span
              className="font-display text-[64px] font-bold leading-none tracking-tighter"
              style={{
                color: tier.accent,
                textShadow: "0 4px 24px rgba(0,0,0,0.45)",
              }}
            >
              {data.ovr}
            </span>
            <p className="text-[9px] font-bold tracking-[0.3em] opacity-60 -mt-1">
              OVERALL
            </p>
          </div>
        </div>

        {/* hero photo + overlapping name */}
        <div className="relative mt-1 flex justify-center">
          {data.photoUrl ? (
            <Image
              src={data.photoUrl}
              alt=""
              width={176}
              height={176}
              className="h-44 w-44 rounded-2xl object-cover"
              style={{
                border: `3px solid ${tier.accent}`,
                boxShadow: `0 12px 40px rgba(0,0,0,0.5), 0 0 0 6px ${tier.accent}22`,
              }}
            />
          ) : (
            <div
              className="flex h-44 w-44 items-center justify-center rounded-2xl bg-white/10 text-6xl"
              style={{ border: `3px solid ${tier.accent}` }}
            >
              🏀
            </div>
          )}
          {/* giant name overlapping photo bottom */}
          <p
            className="absolute -bottom-4 left-0 right-0 text-center text-[40px] font-black uppercase leading-none tracking-tight"
            style={{ textShadow: "0 3px 16px rgba(0,0,0,0.7)" }}
          >
            {data.nickname}
          </p>
        </div>

        {/* meta row */}
        <div className="mt-7 flex items-center justify-center gap-2 text-[11px] opacity-80">
          <span>{data.heightCm ?? "–"} ซม.</span>
          <span className="opacity-40">|</span>
          <span>{data.weightKg ?? "–"} กก.</span>
          <span className="opacity-40">|</span>
          <span className="flex gap-1">
            {data.positions.map((p) => (
              <b key={p} style={{ color: tier.accent }}>
                {p}
              </b>
            ))}
          </span>
        </div>

        {/* stat bar */}
        <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-black/30 px-3 py-3 backdrop-blur-sm">
          <BigStat value={data.ppg.toFixed(1)} label="PTS" accent={tier.accent} />
          <BigStat value={data.rpg.toFixed(1)} label="REB" accent={tier.accent} />
          <BigStat value={data.apg.toFixed(1)} label="AST" accent={tier.accent} />
          <BigStat
            value={data.fgPct != null ? `${Math.round(data.fgPct)}` : "–"}
            label={data.fgPct != null ? "FG%" : "FG"}
            accent={tier.accent}
          />
        </div>

        <p className="mt-3 text-center text-[9px] tracking-[0.3em] opacity-50">
          {data.gamesPlayed > 0
            ? `${data.gamesPlayed} GAMES PLAYED · BASKETBOS`
            : "ลงเล่นเก็บสถิติเพื่ออัพเกรดการ์ด 🔥"}
        </p>
      </div>
    </div>
  );
}
