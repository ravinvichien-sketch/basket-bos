"use client";

import { useActionState } from "react";
import { submitOwnStats, type ActionState } from "../actions";

const FIELDS: [string, string][] = [
  ["points", "แต้ม"],
  ["rebounds", "รีบาวด์"],
  ["assists", "แอสซิสต์"],
  ["steals", "สตีล"],
  ["blocks", "บล็อก"],
  ["turnovers", "เสียบอล"],
];

/** นักกีฬาคีย์สถิติตัวเองย้อนหลัง → ส่งให้แอดมินอนุมัติ */
export function SubmitStatsForm({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    submitOwnStats.bind(null, gameId),
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <p className="text-xs text-ink-faint">
        กรอกสถิติของคุณใน Session นี้ แล้วส่งให้แอดมินยืนยันก่อนถึงจะนับ
      </p>
      <div className="grid grid-cols-3 gap-2">
        {FIELDS.map(([name, label]) => (
          <label key={name} className="text-center">
            <span className="block text-[11px] text-ink-dim mb-1">{label}</span>
            <input
              name={name}
              type="number"
              inputMode="numeric"
              min={0}
              defaultValue={0}
              className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-court"
            />
          </label>
        ))}
      </div>
      <input
        name="note"
        maxLength={100}
        placeholder="หมายเหตุ (ถ้ามี) เช่น เกมที่ 2-3"
        className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending ? "กำลังส่ง..." : "ส่งสถิติให้แอดมินอนุมัติ"}
      </button>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
      {state.saved && (
        <p className="text-xs text-emerald-400">
          ✓ ส่งแล้ว — รอแอดมินก๊วน/แอดมินระบบยืนยัน
        </p>
      )}
    </form>
  );
}
