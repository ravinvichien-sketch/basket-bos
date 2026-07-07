"use client";

import { useState, useTransition } from "react";
import { setGroupMemberAdmin } from "../actions";

/** จัดการแอดมินของก๊วนหนึ่ง ๆ: เพิ่ม/ถอน สมาชิกเป็นแอดมินก๊วน */
export function GroupAdminManager({
  groupId,
  members,
  initialAdminIds,
}: {
  groupId: string;
  members: { id: string; nickname: string }[];
  initialAdminIds: string[];
}) {
  const [adminIds, setAdminIds] = useState<string[]>(initialAdminIds);
  const [pick, setPick] = useState("");
  const [pending, start] = useTransition();

  const adminSet = new Set(adminIds);
  const admins = members.filter((m) => adminSet.has(m.id));
  const candidates = members.filter((m) => !adminSet.has(m.id));

  const add = (id: string) => {
    if (!id) return;
    setAdminIds((prev) => [...prev, id]);
    setPick("");
    start(async () => {
      const res = await setGroupMemberAdmin(groupId, id, true);
      if (res?.error) setAdminIds((prev) => prev.filter((x) => x !== id));
    });
  };
  const remove = (id: string) => {
    setAdminIds((prev) => prev.filter((x) => x !== id));
    start(async () => {
      const res = await setGroupMemberAdmin(groupId, id, false);
      if (res?.error) setAdminIds((prev) => [...prev, id]);
    });
  };

  return (
    <div className="mt-2 space-y-2">
      {admins.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {admins.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-1.5 rounded-full bg-court/15 text-court pl-3 pr-1.5 py-1 text-xs font-semibold"
            >
              {a.nickname}
              <button
                onClick={() => remove(a.id)}
                disabled={pending}
                aria-label={`ถอน ${a.nickname}`}
                className="h-5 w-5 rounded-full bg-court/20 hover:bg-court/40 transition disabled:opacity-50"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-ink-faint">ยังไม่มีแอดมินก๊วน</p>
      )}

      <div className="flex gap-2">
        <select
          value={pick}
          onChange={(e) => setPick(e.target.value)}
          disabled={pending || candidates.length === 0}
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
        >
          <option value="">เพิ่มแอดมินก๊วน...</option>
          {candidates.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nickname}
            </option>
          ))}
        </select>
        <button
          onClick={() => add(pick)}
          disabled={pending || !pick}
          className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          เพิ่ม
        </button>
      </div>
    </div>
  );
}
