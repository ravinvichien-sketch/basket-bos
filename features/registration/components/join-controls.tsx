"use client";

import { useActionState } from "react";
import { joinGame, leaveGame, registerMaybe, confirmFromMaybe, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";

export function JoinControls({
  gameId,
  myStatus,
  waitlistPosition,
  isFull,
  joinOpen,
  cancelAllowed,
}: {
  gameId: string;
  myStatus: "confirmed" | "waitlisted" | "tentative" | null;
  waitlistPosition?: number;
  isFull: boolean;
  joinOpen: boolean;
  cancelAllowed: boolean;
}) {
  const [joinState, joinAction, joinPending] = useActionState<ActionState, FormData>(
    joinGame.bind(null, gameId), {}
  );
  const [leaveState, leaveAction, leavePending] = useActionState<ActionState, FormData>(
    leaveGame.bind(null, gameId), {}
  );
  const [maybeState, maybeAction, maybePending] = useActionState<ActionState, FormData>(
    registerMaybe.bind(null, gameId), {}
  );
  const [confirmState, confirmAction, confirmPending] = useActionState<ActionState, FormData>(
    confirmFromMaybe.bind(null, gameId), {}
  );

  const error = joinState.error ?? leaveState.error ?? maybeState.error ?? confirmState.error;

  return (
    <div className="space-y-3">
      {myStatus === "confirmed" && (
        <div className="rounded-xl2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-center">
          <p className="font-bold text-emerald-400">คุณลงชื่อแล้ว ✓</p>
          <p className="text-xs text-ink-dim mt-0.5">เจอกันในสนาม 🏀</p>
        </div>
      )}

      {myStatus === "tentative" && (
        <div className="rounded-xl2 bg-blue-500/10 border border-blue-500/30 px-4 py-3 text-center space-y-2">
          <p className="font-bold text-blue-400">คุณลงไม่แน่นอน 🤷</p>
          <p className="text-xs text-ink-dim">
            ยังไม่นับรวมในตัวจริง — กดยืนยันด้านล่างเมื่อแน่ใจ
          </p>
          <form action={confirmAction}>
            <Button type="submit" size="md" disabled={confirmPending}>
              {confirmPending ? "กำลังยืนยัน..." : "✅ ยืนยันเล่น (ถ้ายังมีที่)"}
            </Button>
          </form>
        </div>
      )}

      {myStatus === "waitlisted" && (
        <div className="rounded-xl2 bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-center">
          <p className="font-bold text-amber-400">
            คุณอยู่คิวสำรอง อันดับ {waitlistPosition ?? "-"}
          </p>
          <p className="text-xs text-ink-dim mt-0.5">
            ถ้ามีคนถอนตัว ระบบจะเลื่อนคุณขึ้นอัตโนมัติ
          </p>
        </div>
      )}

      {myStatus === null && joinOpen && (
        <div className="flex gap-2">
          <form action={joinAction} className="flex-1">
            <Button type="submit" size="lg" className="w-full" disabled={joinPending}>
              {joinPending
                ? "กำลังลงชื่อ..."
                : isFull
                  ? "ลงชื่อสำรอง"
                  : "🏀 ลงชื่อเล่น"}
            </Button>
          </form>
          <form action={maybeAction}>
            <Button
              type="submit"
              variant="secondary"
              size="lg"
              disabled={maybePending}
            >
              {maybePending ? "..." : "🤷 ไม่แน่นอน"}
            </Button>
          </form>
        </div>
      )}

      {myStatus === null && !joinOpen && (
        <p className="rounded-xl bg-surface-overlay px-4 py-3 text-center text-sm text-ink-faint">
          ยังไม่เปิดรับสมัคร หรือปิดรับไปแล้ว
        </p>
      )}

      {myStatus !== null && cancelAllowed && myStatus !== "tentative" && (
        <form
          action={leaveAction}
          onSubmit={(e) => {
            if (!confirm("ยืนยันถอนตัวจากเกมนี้?")) e.preventDefault();
          }}
        >
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={leavePending}
            className="text-red-400"
          >
            {leavePending ? "กำลังถอนตัว..." : "ถอนตัว"}
          </Button>
        </form>
      )}

      {myStatus === "tentative" && cancelAllowed && (
        <form
          action={leaveAction}
          onSubmit={(e) => {
            if (!confirm("ยกเลิกสถานะไม่แน่นอน?")) e.preventDefault();
          }}
        >
          <Button
            type="submit"
            variant="secondary"
            size="lg"
            disabled={leavePending}
            className="text-red-400"
          >
            ยกเลิกไม่แน่นอน
          </Button>
        </form>
      )}

      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
