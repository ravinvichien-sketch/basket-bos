import type { PlayerCardData } from "./player-card";

function Logo({ accent }: { accent: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={accent}
          strokeWidth="2"
        />
        <path
          d="M2 12h20 M12 2v20 M4.5 5.5c3 2.5 3 10.5 0 13 M19.5 5.5c-3 2.5-3 10.5 0 13"
          fill="none"
          stroke={accent}
          strokeWidth="1.6"
        />
      </svg>
      <span className="font-display text-[12px] font-bold tracking-[0.22em] leading-none">
        BASKET<span style={{ color: accent }}>BOS</span>
      </span>
    </span>
  );
}

function RailStat({
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
        <span className="text-4xl font-bold tabular-nums tracking-tight">
          {intPart}
        </span>
        {decPart !== undefined && (
          <span
            className="align-super text-base font-bold"
            style={{ color: accent }}
          >
            .{decPart}
          </span>
        )}
      </p>
      <p className="mt-1 text-[9px] font-bold tracking-[0.3em] opacity-60">
        {label}
      </p>
    </div>
  );
}

/**
 * การ์ดโปร — รูปถ่ายเต็มใบแบบการ์ดสะสมจริง + กราฟิกซ้อน + โลโก้ BASKET BOS
 * ลำดับรูป: รูปการ์ด (เต็มใบ) → die-cut บนพื้น tier → ไอคอนบอล
 */
export function ProCard({
  data,
  cutoutUrl,
}: {
  data: PlayerCardData;
  cutoutUrl: string | null;
}) {
  const { tier } = data;
  const bgPhoto = data.photoUrl;

  return (
    <div
      className="relative aspect-[4/5] overflow-hidden rounded-3xl text-white select-none"
      style={{ background: tier.gradient }}
    >
      {/* รูปถ่ายเต็มใบ */}
      {bgPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgPhoto}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : cutoutUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cutoutUrl}
          alt=""
          className="absolute inset-x-0 bottom-[22%] mx-auto h-[55%] w-auto max-w-[85%] object-contain drop-shadow-[0_24px_48px_rgba(0,0,0,0.65)]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-8xl opacity-40">
          🏀
        </div>
      )}

      {/* เงาไล่บน-ล่างให้ตัวหนังสืออ่านออกบนรูป */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 26%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.35) 68%, rgba(0,0,0,0.88) 100%)",
        }}
      />

      {/* halftone texture บางๆ */}
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1.5px)",
          backgroundSize: "14px 14px",
        }}
      />

      {/* กรอบการ์ดสี tier */}
      <div
        className="pointer-events-none absolute inset-2 rounded-[20px]"
        style={{ border: `1.5px solid ${tier.accent}88` }}
      />

      {/* header: โลโก้ + OVR */}
      <div className="absolute top-5 inset-x-6 flex items-start justify-between">
        <div>
          <Logo accent={tier.accent} />
          <p className="mt-1 text-[8px] font-bold tracking-[0.3em] opacity-60">
            SEASON 2026 · {tier.label}
          </p>
        </div>
        <div className="text-right leading-none">
          <span
            className="font-display text-6xl font-bold tracking-tight"
            style={{
              color: tier.accent,
              textShadow: "0 6px 28px rgba(0,0,0,0.7)",
            }}
          >
            {data.ovr}
          </span>
          <p className="text-[9px] font-bold tracking-[0.3em] opacity-70 -mt-0.5">
            OVR
          </p>
        </div>
      </div>

      {/* ข้อความแนวตั้งขวา */}
      <p
        className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[8px] font-bold tracking-[0.4em] opacity-45"
        style={{ writingMode: "vertical-rl" }}
      >
        {data.gamesPlayed > 0
          ? `${data.gamesPlayed} GAMES PLAYED`
          : "ROOKIE SEASON"}
      </p>

      {/* ชื่อ + meta + stat rail */}
      <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
        <div className="mb-1 flex items-end justify-between">
          <p
            className="font-display text-4xl font-bold uppercase tracking-tight truncate pr-2"
            style={{ textShadow: "0 4px 20px rgba(0,0,0,0.9)" }}
          >
            {data.nickname}
          </p>
          <span
            className="mb-1 shrink-0 rounded px-2 py-0.5 text-[10px] font-black tracking-widest"
            style={{ backgroundColor: `${tier.accent}33`, color: tier.accent }}
          >
            {data.positions.join(" / ") || "–"}
          </span>
        </div>
        <p className="mb-3 text-[10px] tracking-[0.25em] opacity-75">
          {data.heightCm ?? "–"} CM · {data.weightKg ?? "–"} KG ·{" "}
          {tier.thai.toUpperCase()}
        </p>
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-black/45 px-3 py-3.5 backdrop-blur-sm">
          <RailStat value={data.ppg.toFixed(1)} label="PTS" accent={tier.accent} />
          <RailStat value={data.rpg.toFixed(1)} label="REB" accent={tier.accent} />
          <RailStat value={data.apg.toFixed(1)} label="AST" accent={tier.accent} />
          <RailStat
            value={data.fgPct != null ? `${Math.round(data.fgPct)}` : "–"}
            label={data.fgPct != null ? "FG%" : "FG"}
            accent={tier.accent}
          />
        </div>
      </div>
    </div>
  );
}
