"use client";

import { useState, useTransition } from "react";
import { setGroupLocation } from "../actions";

export function GroupLocationEditor({
  groupId,
  currentLocation,
  currentLat,
  currentLng,
  canManage,
}: {
  groupId: string;
  currentLocation: string | null;
  currentLat: number | null;
  currentLng: number | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [loc, setLoc] = useState(currentLocation ?? "");
  const [lat, setLat] = useState(String(currentLat ?? ""));
  const [lng, setLng] = useState(String(currentLng ?? ""));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    start(async () => {
      const r = await setGroupLocation(
        groupId,
        loc.trim(),
        lat ? parseFloat(lat) : null,
        lng ? parseFloat(lng) : null
      );
      if (r.error) setError(r.error);
      else setEditing(false);
    });
  };

  return (
    <div className="space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            placeholder="ชื่อสถานที่ (เช่น สนามกีฬาจุฬา)"
            maxLength={200}
            className="h-10 w-full rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
          />
          <div className="flex gap-2">
            <input
              value={lat}
              onChange={(e) => setLat(e.target.value)}
              placeholder="ละติจูด"
              type="number"
              step="any"
              className="h-10 w-1/2 rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
              disabled={pending}
            />
            <input
              value={lng}
              onChange={(e) => setLng(e.target.value)}
              placeholder="ลองจิจูด"
              type="number"
              step="any"
              className="h-10 w-1/2 rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
              disabled={pending}
            />
          </div>
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
            {currentLocation ? (
              <div>
                <p className="text-sm">📍 {currentLocation}</p>
                {currentLat && currentLng && (
                  <p className="text-xs text-ink-faint">
                    {currentLat.toFixed(4)}, {currentLng.toFixed(4)}
                  </p>
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
