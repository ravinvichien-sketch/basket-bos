"use client";

import { useActionState, useState } from "react";
import { createGroup, type ActionState } from "../actions";

export function CreateGroupForm() {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createGroup,
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <input
        name="name"
        required
        maxLength={60}
        placeholder="ชื่อก๊วนใหม่ เช่น บาสพุธเย็น"
        className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />
      <div className="space-y-1">
        <input
          name="line_group_id"
          placeholder="LINE Group ID (ไม่บังคับ)"
          className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        />
        <p className="text-[11px] text-ink-faint pl-1">
          ใส่ทีหลังก็ได้ — เชิญบอท Basket Bos เข้า LINE Group แล้วบอทจะตอบ ID มา
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-ink-faint mb-1">เริ่มเล่น (เวลา)</label>
          <input
            name="play_start_time"
            type="time"
            defaultValue="19:00"
            className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint mb-1">เลิกเล่น (เวลา)</label>
          <input
            name="play_end_time"
            type="time"
            defaultValue="21:00"
            className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending ? "..." : "สร้างก๊วน"}
      </button>
      {state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
    </form>
  );
}
