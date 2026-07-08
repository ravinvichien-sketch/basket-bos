"use client";

import { useTransition } from "react";
import { deleteGame } from "../actions";

export function AdminGameActions({ gameId }: { gameId: string }) {
  const [pending, start] = useTransition();

  return (
    <div className="absolute top-2 right-2 flex gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={(e) => {
          e.preventDefault();
          if (!window.confirm("ลบ Session นี้ถาวร?\n\nการกระทำนี้ไม่สามารถย้อนกลับได้")) return;
          start(() => deleteGame(gameId));
        }}
        className="h-7 rounded-lg bg-red-500/15 px-2 text-[11px] text-red-400 font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
      >
        {pending ? "..." : "ลบ"}
      </button>
    </div>
  );
}
