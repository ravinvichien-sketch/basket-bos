"use client";

import { useState, useTransition } from "react";
import { setGroupLocation } from "../actions";

export function GroupLocationEditor({
  groupId,
  currentLocation,
  currentLocationName,
  canManage,
}: {
  groupId: string;
  currentLocation: string | null;
  currentLocationName: string | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentLocationName ?? "");
  const [url, setUrl] = useState(currentLocation ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    start(async () => {
      const r = await setGroupLocation(groupId, name, url);
      if (r.error) setError(r.error);
      else setEditing(false);
    });
  };

  return (
    <div className="space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ชื่อสถานที่ (เช่น สนามกีฬาจุฬา)"
            maxLength={200}
            className="h-10 w-full rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
          />
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="ลิงก์ Google Maps (วาง link ที่นี่)"
            maxLength={500}
            className="h-10 w-full rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
          />
          <p className="text-xs text-ink-faint">
            เปิด Google Maps → กด "แชร์" หรือ "คัดลอกลิงก์" → วางในช่องด้านบน
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={pending}
              className="rounded-xl bg-court px-4 py-2 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
            >
              บันทึก
            </button>
            <button
              onClick={() => setEditing(false)}
              disabled={pending}
              className="rounded-xl bg-surface-overlay px-4 py-2 text-sm hover:bg-surface transition"
            >
              ยกเลิก
            </button>
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
      ) : (
        <div className="flex items-center justify-between">
          <div>
            {currentLocationName ? (
              <div>
                <p className="text-sm font-medium">{currentLocationName}</p>
                {currentLocation && (
                  <a
                    href={currentLocation}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-court underline hover:text-court-dark transition mt-0.5"
                  >
                    เปิด Google Maps →
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-ink-faint">ยังไม่ระบุสถานที่</p>
            )}
          </div>
          {canManage && (
            <button
              onClick={() => setEditing(true)}
              className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-semibold hover:bg-surface-overlay/70 transition"
            >
              แก้ไข
            </button>
          )}
        </div>
      )}
    </div>
  );
}
