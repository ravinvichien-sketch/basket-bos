// ============================================================
// Legend Cards — ตัวละคร "ตำนาน" ต้นฉบับของ Basket Bos
// หมายเหตุ: ไม่ใช้ชื่อ/รูป/ทีมของผู้เล่นจริงเพื่อเลี่ยงปัญหาลิขสิทธิ์
//           (right of publicity / trademark). ทุกชื่อเป็นออริจินอล.
// การ์ดไม่ผูกกับรูปภายนอก — ใช้ tier + gradient ในการ render (เสถียร, ฟรี)
// ============================================================

export interface LegendCard {
  name: string;
  imageUrl: string; // เว้นว่างไว้เสมอในเฟสนี้ (ไม่ fetch รูปนอก) — เผื่ออาร์ตต้นฉบับภายหลัง
  tier: LegendTier;
  desc: string;
  team: string; // สังกัดสมมติ (flavor เท่านั้น ไม่โชว์บนการ์ด)
}

export type LegendTier = "legend" | "allstar" | "star" | "solid" | "roleplayer";

export const TIER_LABELS: Record<LegendTier, string> = {
  legend: "ตำนาน",
  allstar: "ออลสตาร์",
  star: "ดาวเด่น",
  solid: "ตัวจริง",
  roleplayer: "ตัวสำรอง",
};

export const TIER_COLORS: Record<LegendTier, string> = {
  legend: "#F59E0B",
  allstar: "#8B5CF6",
  star: "#3B82F6",
  solid: "#10B981",
  roleplayer: "#6B7280",
};

// ตัวละครต้นฉบับทั้งหมด — ตั้งชื่อเอง ไม่อ้างอิงคนจริง
const P: Record<LegendTier, LegendCard[]> = {
  legend: [
    { name: "The Phantom", imageUrl: "", tier: "legend", desc: "เงาที่ไล่ตามไม่ทัน", team: "Bos Legends" },
    { name: "Sky Emperor", imageUrl: "", tier: "legend", desc: "เจ้าเวหาเหนือแป้น", team: "Bos Legends" },
    { name: "Iron General", imageUrl: "", tier: "legend", desc: "แม่ทัพเหล็ก", team: "Bos Legends" },
    { name: "Night Reaper", imageUrl: "", tier: "legend", desc: "นักล่ายามค่ำ", team: "Bos Legends" },
    { name: "The Oracle", imageUrl: "", tier: "legend", desc: "ผู้หยั่งรู้เกม", team: "Bos Legends" },
    { name: "Titan Prime", imageUrl: "", tier: "legend", desc: "ไททันตัวจริง", team: "Bos Legends" },
    { name: "Ghost Blade", imageUrl: "", tier: "legend", desc: "ใบมีดล่องหน", team: "Bos Legends" },
    { name: "The Monarch", imageUrl: "", tier: "legend", desc: "ราชาแห่งสนาม", team: "Bos Legends" },
  ],
  allstar: [
    { name: "Blaze Runner", imageUrl: "", tier: "allstar", desc: "เปลวไฟความเร็วสูง", team: "All-Star Squad" },
    { name: "Storm Guard", imageUrl: "", tier: "allstar", desc: "การ์ดพายุ", team: "All-Star Squad" },
    { name: "Steel Fox", imageUrl: "", tier: "allstar", desc: "จิ้งจอกเหล็ก", team: "All-Star Squad" },
    { name: "Nova Strike", imageUrl: "", tier: "allstar", desc: "หมัดโนวา", team: "All-Star Squad" },
    { name: "Viper", imageUrl: "", tier: "allstar", desc: "งูพิษเจาะวง", team: "All-Star Squad" },
    { name: "Comet", imageUrl: "", tier: "allstar", desc: "ดาวหางพาดฟ้า", team: "All-Star Squad" },
    { name: "The Architect", imageUrl: "", tier: "allstar", desc: "สถาปนิกเกมรุก", team: "All-Star Squad" },
    { name: "Frost Wing", imageUrl: "", tier: "allstar", desc: "ปีกน้ำแข็ง", team: "All-Star Squad" },
  ],
  star: [
    { name: "Rapid Ace", imageUrl: "", tier: "star", desc: "เอซความไว", team: "Rising Stars" },
    { name: "Shadow Dash", imageUrl: "", tier: "star", desc: "พุ่งทะยานในเงา", team: "Rising Stars" },
    { name: "Bolt", imageUrl: "", tier: "star", desc: "สายฟ้า", team: "Rising Stars" },
    { name: "Zephyr", imageUrl: "", tier: "star", desc: "สายลมกริบ", team: "Rising Stars" },
    { name: "Ranger", imageUrl: "", tier: "star", desc: "พรานระยะไกล", team: "Rising Stars" },
    { name: "Pulse", imageUrl: "", tier: "star", desc: "จังหวะหัวใจเกม", team: "Rising Stars" },
    { name: "Drift King", imageUrl: "", tier: "star", desc: "ราชาการเลี้ยง", team: "Rising Stars" },
    { name: "Ember", imageUrl: "", tier: "star", desc: "ถ่านไฟคุ", team: "Rising Stars" },
  ],
  solid: [
    { name: "Anchor", imageUrl: "", tier: "solid", desc: "สมอหลักของทีม", team: "Core Unit" },
    { name: "Grit", imageUrl: "", tier: "solid", desc: "ใจสู้ไม่ถอย", team: "Core Unit" },
    { name: "Steady Hand", imageUrl: "", tier: "solid", desc: "มือนิ่ง", team: "Core Unit" },
    { name: "Workhorse", imageUrl: "", tier: "solid", desc: "ม้างานหนัก", team: "Core Unit" },
    { name: "Tempo", imageUrl: "", tier: "solid", desc: "คุมจังหวะ", team: "Core Unit" },
    { name: "Compass", imageUrl: "", tier: "solid", desc: "เข็มทิศเกม", team: "Core Unit" },
    { name: "Flint", imageUrl: "", tier: "solid", desc: "หินเหล็กไฟ", team: "Core Unit" },
    { name: "Bulwark", imageUrl: "", tier: "solid", desc: "ปราการ", team: "Core Unit" },
  ],
  roleplayer: [
    { name: "Spark", imageUrl: "", tier: "roleplayer", desc: "ประกายไฟ", team: "Bench Mob" },
    { name: "Hustle", imageUrl: "", tier: "roleplayer", desc: "ขยันวิ่ง", team: "Bench Mob" },
    { name: "Glue", imageUrl: "", tier: "roleplayer", desc: "กาวประสานทีม", team: "Bench Mob" },
    { name: "Scout", imageUrl: "", tier: "roleplayer", desc: "หน่วยสอดแนม", team: "Bench Mob" },
    { name: "Motor", imageUrl: "", tier: "roleplayer", desc: "เครื่องยนต์ไม่มีหมด", team: "Bench Mob" },
    { name: "Sixth Man", imageUrl: "", tier: "roleplayer", desc: "ตัวที่หก", team: "Bench Mob" },
    { name: "Utility", imageUrl: "", tier: "roleplayer", desc: "อเนกประสงค์", team: "Bench Mob" },
    { name: "Rookie Heart", imageUrl: "", tier: "roleplayer", desc: "หัวใจมือใหม่", team: "Bench Mob" },
  ],
};

/**
 * เลือกการ์ดตำนานจากสถิติของ session
 * ยิ่งเล่นดี (Game Score เฉลี่ยสูง) ยิ่งได้ tier สูง + มีดวง 5% เด้งขึ้น 1 ขั้น
 */
export function getLegendForStats(
  totals: { points: number; assists: number; rebounds: number; steals: number; blocks: number; fga: number; fgm: number; games: number }
): LegendCard {
  const avgGs = totals.games > 0
    ? (totals.points + 0.7 * totals.assists + 0.7 * totals.rebounds + totals.steals + 0.7 * totals.blocks) / totals.games
    : 0;

  let baseTier: LegendTier;
  if (avgGs >= 20) baseTier = "legend";
  else if (avgGs >= 14) baseTier = "allstar";
  else if (avgGs >= 9) baseTier = "star";
  else if (avgGs >= 5) baseTier = "solid";
  else baseTier = "roleplayer";

  // ดวง 5%: เด้งขึ้น 1 tier (วันเล่นห่วยก็มีลุ้นการ์ดระดับสูง)
  const roll = Math.random();
  if (roll < 0.05 && baseTier !== "legend") {
    const tierOrder: LegendTier[] = ["roleplayer", "solid", "star", "allstar", "legend"];
    const idx = tierOrder.indexOf(baseTier);
    if (idx < tierOrder.length - 1) baseTier = tierOrder[idx + 1];
  }

  const pool = P[baseTier];
  return pool[Math.floor(Math.random() * pool.length)];
}
