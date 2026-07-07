"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setActingAdmin } from "../actions";

/**
 * มอบสิทธิ์คุม "เฉพาะนัดนี้" ให้คนอื่นชั่วคราว (เผื่อแอดมินก๊วนไม่ว่าง)
 * นัดใหม่จะเริ่มที่ค่า default เสมอ (ไม่มีการมอบต่อ)
 */
export function DelegateAdminControl({
  gameId,
  actingId,
  actingName,
  candidates,
}: {
  gameId: string;
  actingId: string | null;
  actingName: string | null;
  candidates: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (profileId: string | null) => {
    setError(null);
    start(async () => {
      const res = await setActingAdmin(gameId, profileId);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="mt-3 rounded-xl bg-surface-overlay p-3 space-y-2">
      <p className="text-xs text-ink-dim">
        มอบสิทธิ์คุมนัดนี้ชั่วคราว (เฉพาะนัดนี้ — นัดใหม่กลับเป็นค่าเดิม)
      </p>

      {actingId ? (
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">
            กำลังมอบให้ <span className="font-semibold text-court">{actingName}</span>
          </span>
          <button
            onClick={() => run(null)}
            disabled={pending}
            className="rounded-lg bg-red-500/15 text-red-400 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
          >
            คืนสิทธิ์
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={pending || candidates.length === 0}
            className="h-10 flex-1 rounded-xl bg-surface-raised border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          >
            <option value="">เลือกคนที่จะมอบสิทธิ์...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
          <button
            onClick={() => pick && run(pick)}
            disabled={pending || !pick}
            className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            มอบสิทธิ์
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
