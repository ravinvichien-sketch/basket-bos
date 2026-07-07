import type { GameStatus } from "@/types/database";

export const GAME_STATUS_LABELS: Record<GameStatus, string> = {
  draft: "ฉบับร่าง",
  open: "เปิดรับสมัคร",
  closed: "ปิดรับสมัคร",
  in_progress: "กำลังแข่ง",
  completed: "จบแล้ว",
  cancelled: "ยกเลิก",
};

export const GAME_STATUS_STYLES: Record<GameStatus, string> = {
  draft: "bg-slate-500/15 text-slate-400",
  open: "bg-emerald-500/15 text-emerald-400",
  closed: "bg-amber-500/15 text-amber-400",
  in_progress: "bg-sky-500/15 text-sky-400",
  completed: "bg-slate-500/15 text-slate-400",
  cancelled: "bg-red-500/15 text-red-400",
};

/** Allowed lifecycle transitions (enforced server-side). */
export const STATUS_TRANSITIONS: Record<GameStatus, GameStatus[]> = {
  draft: ["open", "cancelled"],
  open: ["closed", "in_progress", "cancelled"],
  closed: ["open", "in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};

export const TRANSITION_LABELS: Partial<Record<GameStatus, string>> = {
  open: "เปิดรับสมัคร",
  closed: "ปิดรับสมัคร",
  in_progress: "เริ่มแข่ง",
  completed: "จบเกม",
  cancelled: "ยกเลิกเกม",
};
