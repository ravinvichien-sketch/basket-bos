"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addStatKeeper, removeStatKeeper } from "../actions";

export function StatKeeperManager({
  gameId,
  currentKeepers,
  candidates,
  canManage,
}: {
  gameId: string;
  currentKeepers: { id: string; nickname: string; avatarUrl: string | null }[];
  candidates: { id: string; nickname: string; avatarUrl: string | null }[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const add = () => {
    if (!pick) return;
    setPick("");
    setError(null);
    start(async () => {
      const res = await addStatKeeper(gameId, pick);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const remove = (profileId: string) => {
    setError(null);
    start(async () => {
      const res = await removeStatKeeper(gameId, profileId);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  };

  const available = candidates.filter(
    (c) => !currentKeepers.some((k) => k.id === c.id)
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-ink-faint">
          {currentKeepers.length > 0
            ? `ผู้ช่วย ${currentKeepers.length} คน`
            : "ยังไม่มีผู้ช่วย"}
        </p>
      </div>

      {currentKeepers.length > 0 && (
        <ul className="divide-y divide-white/5">
          {currentKeepers.map((k) => (
            <li key={k.id} className="flex items-center gap-2 py-1.5 text-sm">
              {k.avatarUrl ? (
                <Image src={k.avatarUrl} alt="" width={24} height={24} className="rounded-full" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-surface-overlay flex items-center justify-center text-[10px]">🏀</span>
              )}
              <span className="flex-1 truncate">{k.nickname}</span>
              {canManage && (
                <button
                  onClick={() => remove(k.id)}
                  disabled={pending}
                  className="h-6 w-6 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
                  aria-label="เอาออก"
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && available.length > 0 && (
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={pending}
            className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          >
            <option value="">เพิ่มผู้ช่วย...</option>
            {available.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
          <button
            onClick={add}
            disabled={pending || !pick}
            className="h-10 rounded-xl bg-court px-3 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
