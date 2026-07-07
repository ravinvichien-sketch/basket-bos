"use client";

import { useState, useTransition } from "react";
import { saveLineId } from "../actions";

export function LineIdEditor({
  currentLineId,
}: {
  currentLineId: string | null;
}) {
  const [value, setValue] = useState(currentLineId ?? "");
  const [pending, start] = useTransition();
  const [ok, setOk] = useState(false);

  const handleSave = () => {
    setOk(false);
    start(async () => {
      await saveLineId(value.trim());
      setOk(true);
      setTimeout(() => setOk(false), 2000);
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-faint">
        ตั้ง LINE ID (Public ID) เพื่อให้คนอื่นเพิ่มเพื่อนคุณได้
      </p>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="LINE ID ของคุณ"
          maxLength={30}
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          disabled={pending}
        />
        <button
          onClick={handleSave}
          disabled={pending}
          className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          {ok ? "✅ บันทึกแล้ว" : "บันทึก"}
        </button>
      </div>
      {currentLineId && (
        <a
          href={`https://line.me/R/ti/p/${currentLineId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-green-400 hover:text-green-300 transition"
        >
          🔗 ดูโปรไฟล์ LINE ของคุณ
        </a>
      )}
    </div>
  );
}
