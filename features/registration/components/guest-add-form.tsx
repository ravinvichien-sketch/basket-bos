"use client";

import { useActionState, useState } from "react";
import { addGuest, type ActionState } from "../actions";

/**
 * พาเพื่อน (แขก) มาลงชื่อ:
 *  - ปกติ "ผู้ชวน" = ตัวเราเอง (อนุมัติทันที)
 *  - ถ้าเลือกว่าเป็นเพื่อนที่ "คนอื่น" ชวนมา คนนั้นต้องกดอนุมัติก่อน
 */
export function GuestAddForm({
  gameId,
  members,
  meId,
}: {
  gameId: string;
  members: { id: string; nickname: string }[];
  meId: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    addGuest.bind(null, gameId),
    {}
  );
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full h-11 rounded-xl2 border border-dashed border-white/15 text-sm font-semibold text-ink-dim hover:border-court/40 hover:text-ink transition"
      >
        ＋ พาเพื่อนมาเล่น (แขก)
      </button>
    );
  }

  const others = members.filter((m) => m.id !== meId);

  return (
    <form action={formAction} className="space-y-2 rounded-xl2 bg-surface-overlay p-3">
      <input
        name="guest_name"
        required
        maxLength={30}
        placeholder="ชื่อเพื่อนที่พามา"
        className="h-11 w-full rounded-xl bg-surface-raised border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />
      <label className="block text-xs text-ink-faint">เพื่อนใครชวนมา?</label>
      <select
        name="ref_profile_id"
        defaultValue=""
        className="h-11 w-full rounded-xl bg-surface-raised border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      >
        <option value="">ฉันเอง (พามาเอง — อนุมัติทันที)</option>
        {others.map((m) => (
          <option key={m.id} value={m.id}>
            เพื่อนของ {m.nickname} (ต้องให้ {m.nickname} กดอนุมัติ)
          </option>
        ))}
      </select>
      <input
        name="note"
        maxLength={60}
        placeholder="หมายเหตุ (ถ้ามี) เช่น เบอร์โทร"
        className="h-11 w-full rounded-xl bg-surface-raised border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="h-11 flex-1 rounded-xl bg-surface-raised text-sm font-semibold text-ink-dim hover:text-ink transition"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={pending}
          className="h-11 flex-[2] rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          {pending ? "กำลังลงชื่อ..." : "ลงชื่อแขก"}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
