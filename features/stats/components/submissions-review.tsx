"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reviewSubmission } from "../actions";

export interface Submission {
  id: string;
  nickname: string;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  note: string | null;
}

/** แอดมินของนัด: อนุมัติ/ปฏิเสธ สถิติที่นักกีฬาส่งมาย้อนหลัง */
export function SubmissionsReview({
  gameId,
  submissions,
}: {
  gameId: string;
  submissions: Submission[];
}) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (submissions.length === 0) return null;

  const act = (id: string, approve: boolean) => {
    setErr(null);
    start(async () => {
      const res = await reviewSubmission(id, gameId, approve);
      if (res.error) setErr(res.error);
      else router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-faint">
        สถิติที่นักกีฬาส่งมา รออนุมัติ ({submissions.length})
      </p>
      <ul className="space-y-2">
        {submissions.map((s) => (
          <li
            key={s.id}
            className="rounded-xl bg-surface-overlay border border-white/10 p-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{s.nickname}</span>
              <span className="text-[11px] text-ink-faint">รออนุมัติ</span>
            </div>
            <p className="mt-1 text-xs text-ink-dim">
              {s.points} แต้ม · {s.rebounds} รีบ · {s.assists} แอส · {s.steals}{" "}
              สตีล · {s.blocks} บล็อก · {s.turnovers} เสีย
            </p>
            {s.note && (
              <p className="mt-0.5 text-[11px] text-ink-faint">📝 {s.note}</p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => act(s.id, true)}
                disabled={pending}
                className="h-9 flex-1 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50"
              >
                ✓ อนุมัติ (บวกเข้าสถิติ)
              </button>
              <button
                onClick={() => act(s.id, false)}
                disabled={pending}
                className="h-9 flex-1 rounded-lg bg-red-500/15 text-red-400 text-xs font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
              >
                ปฏิเสธ
              </button>
            </div>
          </li>
        ))}
      </ul>
      {err && <p className="text-xs text-red-400">{err}</p>}
    </div>
  );
}
