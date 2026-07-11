// ============================================================
// DEPRECATED — ไฟล์นี้ถูกแทนที่ด้วย legend-cards.ts (ตัวละครต้นฉบับ)
// เก็บไว้เป็น shim เพื่อ backward-compatibility เท่านั้น — ลบทิ้งได้เมื่อสะดวก
// ไม่มีชื่อ/รูปผู้เล่นจริงแล้ว (เลี่ยงลิขสิทธิ์)
// ============================================================

export {
  TIER_LABELS,
  TIER_COLORS,
  getLegendForStats,
  getLegendForStats as getNbaPlayerForStats,
} from "./legend-cards";

export type {
  LegendCard,
  LegendCard as NbaPlayer,
  LegendTier,
  LegendTier as NbaTier,
} from "./legend-cards";
