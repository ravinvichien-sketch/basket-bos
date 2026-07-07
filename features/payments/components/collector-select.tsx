"use client";

import { useState, useTransition } from "react";
import { setCollector } from "../actions";

/** แอดมินแต่งตั้ง "คนเก็บเงิน" ประจำเกม จากรายชื่อผู้เล่นตัวจริง */
export function CollectorSelect({
  gameId,
  current,
  players,
}: {
  gameId: string;
  current: string | null;
  players: { id: string; nickname: string }[];
}) {
  const [value, setValue] = useState(current ?? "");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-1">
      <label className="text-xs text-ink-faint">คนเก็บเงินประจำเกมนี้</label>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          start(async () => {
            await setCollector(gameId, v || null);
          });
        }}
        className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
      >
        <option value="">— ยังไม่กำหนด —</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.nickname}
          </option>
        ))}
      </select>
      <p className="text-[11px] text-ink-faint">
        คนที่ถูกแต่งตั้งจะใส่ PromptPay/เลขบัญชีของตัวเอง แล้วเงินจะโอนเข้าคนนั้น
      </p>
    </div>
  );
}
