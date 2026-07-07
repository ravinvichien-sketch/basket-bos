"use client";

import { useTransition } from "react";
import { deleteGame } from "../actions";

/** ปุ่มลบนัด (แอดมิน/แอดมินก๊วน) — ลบได้ทุกสถานะ เพื่อเคลียร์นัดที่ไม่ครบ/ไม่ใช้ */
export function DeleteGameButton({ gameId }: { gameId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm("ลบนัดนี้? (ประวัติสถิติ/จ่ายเงินยังเก็บไว้ แค่ซ่อนออกจากรายการ)")) return;
        start(() => deleteGame(gameId));
      }}
      className="w-full h-11 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "🗑 ลบนัดนี้"}
    </button>
  );
}
