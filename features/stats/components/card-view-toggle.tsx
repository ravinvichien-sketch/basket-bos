"use client";

import { useState } from "react";
import { PlayerCard, type PlayerCardData } from "./player-card";
import { ProCard } from "./pro-card";
import { cn } from "@/lib/utils";

export function CardViewToggle({
  data,
  cutoutUrl,
}: {
  data: PlayerCardData;
  cutoutUrl: string | null;
}) {
  const [mode, setMode] = useState<"normal" | "pro">(
    cutoutUrl ? "pro" : "normal"
  );

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-overlay p-1">
        {(
          [
            ["normal", "การ์ดปกติ"],
            ["pro", "🔥 การ์ดโปร"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "h-9 rounded-lg text-sm font-semibold transition",
              mode === value
                ? "bg-court text-white"
                : "text-ink-dim hover:text-ink"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "normal" ? (
        <PlayerCard data={data} />
      ) : (
        <>
          <ProCard data={data} cutoutUrl={cutoutUrl} />
          {!cutoutUrl && (
            <p className="text-center text-xs text-ink-faint">
              💡 ไปที่หน้าโปรไฟล์ → กด &ldquo;✂️ AI ตัดพื้นหลัง&rdquo;
              เพื่อให้ตัวลอยแบบโปสเตอร์จริง
            </p>
          )}
        </>
      )}
    </div>
  );
}
