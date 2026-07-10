/** NBA-2K-style overall rating + tier system. */

export interface SeasonStats {
  games_played: number;
  total_minutes: number;
  total_points: number;
  total_fgm: number;
  total_fga: number;
  total_tpm: number;
  total_tpa: number;
  total_ftm: number;
  total_fta: number;
  total_reb_off: number;
  total_reb_def: number;
  total_assists: number;
  total_steals: number;
  total_blocks: number;
  total_turnovers: number;
  total_fouls: number;
  total_plus_minus: number;
  ppg: number;
  rpg: number;
  apg: number;
  spg: number;
  bpg: number;
  fg_pct: number | null;
  tp_pct: number | null;
  mvp_count: number;
}

export type TierKey = "bronze" | "silver" | "gold" | "holo";

export interface Tier {
  key: TierKey;
  label: string;
  thai: string;
  /** tailwind-free inline gradient for card backgrounds */
  gradient: string;
  accent: string;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, v));

/** ทุกคนเริ่มที่คะแนนนี้ แล้วไต่ขึ้นตามการเล่น */
export const BASE_RATING = 50;

/**
 * OVR 50–99. ทุกคนเริ่มที่ 50 เท่ากัน (ไม่ต้องประเมินฝีมือเอง).
 * ยิ่งเล่นบ่อย + เล่นดี คะแนนยิ่งเพิ่ม (ไม่ลดต่ำกว่า 50).
 */
export function computeOvr(stats?: SeasonStats | null): number {
  if (!stats || stats.games_played === 0) return BASE_RATING;

  const production =
    stats.ppg * 1.6 +
    stats.rpg * 1.1 +
    stats.apg * 1.5 +
    stats.spg * 2.0 +
    stats.bpg * 2.0 +
    Math.max(0, (stats.fg_pct ?? 40) - 40) * 0.2 +
    Math.min(stats.mvp_count, 10) * 1.5;

  // ความน่าเชื่อถือเพิ่มตามจำนวน Session (อิ่มตัวที่ 10 Session)
  const weight = Math.min(stats.games_played, 10) / 10;

  return Math.round(clamp(BASE_RATING + production * weight, BASE_RATING, 99));
}

const TIERS: Tier[] = [
  {
    key: "bronze",
    label: "ROOKIE",
    thai: "มือใหม่",
    gradient: "linear-gradient(135deg, #7c5a3a 0%, #4a3423 60%, #241a12 100%)",
    accent: "#d9a066",
  },
  {
    key: "silver",
    label: "STARTER",
    thai: "ตัวจริง",
    gradient: "linear-gradient(135deg, #94a3b8 0%, #475569 55%, #1e293b 100%)",
    accent: "#cbd5e1",
  },
  {
    key: "gold",
    label: "ALL-STAR",
    thai: "ออลสตาร์",
    gradient: "linear-gradient(135deg, #f97316 0%, #b45309 55%, #451a03 100%)",
    accent: "#fbbf24",
  },
  {
    key: "holo",
    label: "LEGEND",
    thai: "ตำนาน",
    gradient:
      "linear-gradient(135deg, #312e81 0%, #831843 45%, #0f172a 100%)",
    accent: "#e879f9",
  },
];

export function tierOf(ovr: number): Tier {
  if (ovr >= 87) return TIERS[3];
  if (ovr >= 75) return TIERS[2];
  if (ovr >= 62) return TIERS[1];
  return TIERS[0];
}
