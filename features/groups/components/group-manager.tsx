"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addGroupMember,
  removeGroupMember,
  setGroupAdmin,
  renameGroup,
  deleteGroup,
} from "../actions";

export interface GroupMemberView {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  role: "admin" | "player";
}

export function GroupManager({
  groupId,
  groupName,
  isSuperAdmin,
  canManage,
  members,
  candidates,
}: {
  groupId: string;
  groupName: string;
  isSuperAdmin: boolean;
  canManage: boolean;
  members: GroupMemberView[];
  candidates: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string } | void>) => {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
      else router.refresh();
    });
  };

  const rename = () => {
    const name = window.prompt("เปลี่ยนชื่อก๊วน", groupName)?.trim();
    if (!name || name === groupName) return;
    run(() => renameGroup(groupId, name));
  };
  const remove = () => {
    if (!window.confirm(`ลบก๊วน “${groupName}”? (Session เก่ายังอยู่)`)) return;
    start(async () => {
      const res = await deleteGroup(groupId);
      if (res?.error) setError(res.error);
      else router.push("/groups");
    });
  };

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="flex gap-2">
          <button
            onClick={rename}
            disabled={pending}
            className="h-10 flex-1 rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition disabled:opacity-50"
          >
            ✎ เปลี่ยนชื่อ
          </button>
          <button
            onClick={remove}
            disabled={pending}
            className="h-10 flex-1 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
          >
            🗑 ลบก๊วน
          </button>
        </div>
      )}

      <ul className="divide-y divide-white/5">
        {members.map((m) => (
          <li key={m.id} className="flex items-center gap-3 py-2.5">
            {m.avatarUrl ? (
              <Image
                src={m.avatarUrl}
                alt=""
                width={32}
                height={32}
                className="rounded-full"
              />
            ) : (
              <span className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
                🏀
              </span>
            )}
            <span className="flex-1 truncate text-sm">{m.nickname}</span>
            {m.role === "admin" && (
              <span className="rounded-full bg-court/15 text-court px-2 py-0.5 text-[10px] font-semibold">
                แอดมินก๊วน
              </span>
            )}
            {(isSuperAdmin || (canManage && m.role !== "admin")) && (
              <button
                onClick={() =>
                  run(() => setGroupAdmin(groupId, m.id, m.role !== "admin"))
                }
                disabled={pending}
                className="rounded-lg bg-surface-overlay px-2 py-1 text-[11px] font-semibold hover:bg-surface-overlay/70 transition disabled:opacity-50"
              >
                {m.role === "admin" ? "ถอนแอดมิน" : "ตั้งแอดมิน"}
              </button>
            )}
            {canManage && (
              <button
                onClick={() => run(() => removeGroupMember(groupId, m.id))}
                disabled={pending}
                aria-label="เอาออก"
                className="h-7 w-7 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
              >
                ✕
              </button>
            )}
          </li>
        ))}
        {members.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-faint">
            ยังไม่มีสมาชิกในก๊วนนี้
          </li>
        )}
      </ul>

      {canManage && candidates.length > 0 && (
        <div className="flex gap-2">
          <select
            value={pick}
            onChange={(e) => setPick(e.target.value)}
            disabled={pending}
            className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court disabled:opacity-50"
          >
            <option value="">เพิ่มสมาชิกเข้าก๊วน...</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              if (!pick) return;
              const id = pick;
              setPick("");
              run(() => addGroupMember(groupId, id));
            }}
            disabled={pending || !pick}
            className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
          >
            เพิ่ม
          </button>
        </div>
      )}

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
