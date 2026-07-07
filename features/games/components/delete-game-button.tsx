"use client";

import { useTransition } from "react";
import { deleteGame } from "../actions";

/** ปุ่มลบ Session (เฉพาะ Super Admin) — ลบแบบถาวร รวมสถิติทั้งหมด */
export function DeleteGameButton({ gameId }: { gameId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (
          !window.confirm(
            "ลบ Session นี้ถาวร?\\n\\n" +
              "• สถิติใน Session ทั้งหมดจะหายไป\\n" +
              "• ข้อมูลจ่ายเงินจะหายไป\\n" +
              "• วีดีโอ/รูปภาพที่อัปโหลดจะหายไป\\n" +
              "\\nการกระทำนี้ไม่สามารถย้อนกลับได้"
          )
        )
          return;
        start(() => deleteGame(gameId));
      }}
      className="w-full h-11 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
    >
      {pending ? "กำลังลบ..." : "🗑 ลบ Session ถาวร"}
    </button>
  );
}
