"use client";

import { useState, useTransition } from "react";
import { setGroupLineGroupId } from "../actions";

export function GroupLineGroupIdEditor({
  groupId,
  currentLineGroupId,
  canManage,
}: {
  groupId: string;
  currentLineGroupId: string | null;
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentLineGroupId ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    start(async () => {
      const r = await setGroupLineGroupId(groupId, value);
      if (r.error) setError(r.error);
      else setEditing(false);
    });
  };

  return (
    <div className="space-y-2">
      {editing ? (
        <div className="space-y-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="LINE Group ID"
            className="h-10 w-full rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
          />
          <p className="text-xs text-ink-faint">
            เชิญบอทเข้ากลุ่ม → พิมพ์ groupid → คัดลอก ID มาวางตรงนี้
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
            {currentLineGroupId ? (
              <p className="text-sm font-mono text-ink-dim">{currentLineGroupId}</p>
            ) : (
              <p className="text-sm text-ink-faint">ยังไม่ได้ผูก LINE Group</p>
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
