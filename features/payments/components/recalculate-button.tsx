"use client";

import { useActionState } from "react";
import { recalculatePaymentAmounts, type ActionState } from "../actions";

export function RecalculateButton({ gameId }: { gameId: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    recalculatePaymentAmounts.bind(null, gameId),
    {}
  );

  return (
    <form action={formAction} className="mt-2">
      <button className="w-full h-10 rounded-xl bg-amber-500/10 text-amber-400 text-sm font-semibold hover:bg-amber-500/20 transition disabled:opacity-50" disabled={pending}>
        {pending ? "กำลังปรับ..." : "🔄 ลบยอดค้าง + สร้างใหม่ตามค่าสนามล่าสุด"}
      </button>
      {state.error && (
        <p className="mt-1 text-xs text-red-400 text-center">{state.error}</p>
      )}
    </form>
  );
}
