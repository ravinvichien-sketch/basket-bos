"use client";

import { useActionState } from "react";
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
          required
          placeholder="LINE Group ID"
          className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        />
        <p className="text-[11px] text-ink-faint pl-1">
          ต้องมี LINE Group ก่อนตั้งก๊วน — ID ดูได้จากแอดมินระบบ
        </p>
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
