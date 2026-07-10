"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setGroupPlayTime } from "../actions";

export function GroupPlayTimeEditor({
  groupId,
  playStartTime,
  playEndTime,
  canManage,
}: {
  groupId: string;
  playStartTime: string | null;
  playEndTime: string | null;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [startTime, setStartTime] = useState(playStartTime ?? "19:00");
  const [endTime, setEndTime] = useState(playEndTime ?? "21:00");
  const [error, setError] = useState<string | null>(null);

  const save = () => {
    setError(null);
    start(async () => {
      const res = await setGroupPlayTime(groupId, startTime, endTime);
      if (res?.error) setError(res.error);
      else router.refresh();
    });
  };

  if (!canManage) {
    if (!playStartTime && !playEndTime) return null;
    return (
      <p className="text-sm text-ink-dim">
        🏀 {playStartTime ?? "??:??"} – {playEndTime ?? "??:??"} น.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-xs text-ink-faint mb-1">เริ่มเล่น</label>
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={pending}
            className="h-10 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          />
        </div>
        <div>
          <label className="block text-xs text-ink-faint mb-1">เลิกเล่น</label>
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={pending}
            className="h-10 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          />
        </div>
      </div>
      <button
        onClick={save}
        disabled={pending}
        className="h-9 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending ? "..." : "บันทึกเวลา"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
