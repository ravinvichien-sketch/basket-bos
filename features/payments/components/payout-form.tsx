"use client";

import { useActionState } from "react";
import { updatePayoutInfo, type ActionState } from "../actions";

/** คนเก็บเงินกรอก PromptPay + เลขบัญชีของตัวเอง (ให้เพื่อนโอนเข้า) */
export function PayoutForm({
  gameId,
  promptpay,
  bankName,
  bankNo,
}: {
  gameId: string;
  promptpay: string | null;
  bankName: string | null;
  bankNo: string | null;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updatePayoutInfo.bind(null, gameId),
    {}
  );

  return (
    <form action={formAction} className="space-y-2">
      <div>
        <label className="text-xs text-ink-faint">PromptPay (เบอร์/เลขบัตร ปชช.)</label>
        <input
          name="promptpay_id"
          defaultValue={promptpay ?? ""}
          inputMode="numeric"
          placeholder="0812345678"
          className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-ink-faint">ธนาคาร</label>
          <input
            name="bank_name"
            defaultValue={bankName ?? ""}
            placeholder="ไทยพาณิชย์"
            className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
        <div className="flex-1">
          <label className="text-xs text-ink-faint">เลขบัญชี</label>
          <input
            name="bank_account_no"
            defaultValue={bankNo ?? ""}
            inputMode="numeric"
            placeholder="123-4-56789-0"
            className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={pending}
        className="h-11 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก..." : "บันทึกบัญชีรับเงิน"}
      </button>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
