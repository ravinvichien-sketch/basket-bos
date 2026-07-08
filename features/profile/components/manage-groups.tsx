"use client";

import { useState, useTransition } from "react";
import { setMyGroups } from "../actions";

export function ManageGroups({
  allGroups,
  myGroupIds,
  canManage,
}: {
  allGroups: { id: string; name: string }[];
  myGroupIds: string[];
  canManage: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(myGroupIds);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggleGroup = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = () => {
    setError(null);
    start(async () => {
      const r = await setMyGroups(selected);
      if (r.error) setError(r.error);
      else setEditing(false);
    });
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-between">
        <div>
          {myGroupIds.length === 0 ? (
            <p className="text-sm text-ink-faint py-2 text-center">
              ยังไม่ได้เป็นสมาชิกก๊วนไหน
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allGroups
                .filter((g) => myGroupIds.includes(g.id))
                .map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center rounded-full bg-court/10 text-court text-xs font-semibold px-3 py-1"
                  >
                    {g.name}
                  </span>
                ))}
            </div>
          )}
        </div>
        {canManage && (
          <button
            onClick={() => setEditing(true)}
            className="rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-semibold hover:bg-surface-overlay/70 transition shrink-0 ml-3"
          >
            แก้ไข
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {allGroups.length === 0 ? (
        <p className="text-sm text-ink-faint">ยังไม่มีก๊วนในระบบ</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {allGroups.map((g) => {
            const sel = selected.includes(g.id);
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => toggleGroup(g.id)}
                className={`h-9 rounded-xl border px-3 text-sm font-semibold transition ${
                  sel
                    ? "border-court bg-court/15 text-court"
                    : "border-white/10 bg-surface-overlay text-ink-dim"
                }`}
              >
                {sel && "✓ "}
                {g.name}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={pending}
          className="rounded-xl bg-court px-4 py-2 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          บันทึก
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setSelected(myGroupIds);
          }}
          disabled={pending}
          className="rounded-xl bg-surface-overlay px-4 py-2 text-sm hover:bg-surface transition"
        >
          ยกเลิก
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {selected.length === 0 && (
        <p className="text-xs text-amber-400">ต้องเลือกอย่างน้อย 1 ก๊วน</p>
      )}
    </div>
  );
}
