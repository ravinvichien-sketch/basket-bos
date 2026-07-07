"use client";

import Image from "next/image";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { assignPlayersToGroup, removePlayersFromGroup } from "../actions";

export interface AdminPlayer {
  id: string;
  nickname: string;
  avatarUrl: string | null;
  groupIds: string[];
}

export function PlayersAdmin({
  players,
  groups,
}: {
  players: AdminPlayer[];
  groups: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<string>("all"); // all | none | <groupId>
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState(groups[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const nameOf = (id: string) => groups.find((g) => g.id === id)?.name ?? "";

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return players.filter((p) => {
      if (s && !p.nickname.toLowerCase().includes(s)) return false;
      if (filter === "all") return true;
      if (filter === "none") return p.groupIds.length === 0;
      return p.groupIds.includes(filter);
    });
  }, [players, q, filter]);

  const noneCount = players.filter((p) => p.groupIds.length === 0).length;

  const toggle = (id: string) =>
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const run = (fn: () => Promise<{ error?: string; done?: number }>, verb: string) => {
    if (sel.size === 0 || !target) return;
    setMsg(null);
    start(async () => {
      const res = await fn();
      if (res.error) setMsg(res.error);
      else {
        setMsg(`${verb} ${res.done} คน กับก๊วน ${nameOf(target)}`);
        setSel(new Set());
        router.refresh();
      }
    });
  };

  const ids = () => [...sel];

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อผู้เล่น..."
        className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />

      <div className="flex flex-wrap gap-2">
        <Chip on={filter === "all"} onClick={() => setFilter("all")}>
          ทั้งหมด ({players.length})
        </Chip>
        <Chip on={filter === "none"} onClick={() => setFilter("none")}>
          ⚠️ ยังไม่เลือกก๊วน ({noneCount})
        </Chip>
        {groups.map((g) => (
          <Chip key={g.id} on={filter === g.id} onClick={() => setFilter(g.id)}>
            {g.name}
          </Chip>
        ))}
      </div>

      {sel.size > 0 && (
        <div className="rounded-xl bg-surface-overlay border border-court/30 p-3 space-y-2">
          <p className="text-xs text-ink-dim">เลือกไว้ {sel.size} คน → จัดการก๊วน</p>
          <div className="flex gap-2">
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="h-10 flex-1 rounded-xl bg-surface-raised border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            >
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() =>
                run(() => assignPlayersToGroup(target, ids()), "เพิ่ม")
              }
              disabled={pending}
              className="h-10 flex-1 rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
            >
              เพิ่มเข้าก๊วน
            </button>
            <button
              onClick={() =>
                run(() => removePlayersFromGroup(target, ids()), "เอาออก")
              }
              disabled={pending}
              className="h-10 flex-1 rounded-xl bg-red-500/15 text-red-400 text-sm font-semibold hover:bg-red-500/25 transition disabled:opacity-50"
            >
              เอาออกจากก๊วน
            </button>
          </div>
          <p className="text-[11px] text-ink-faint">
            ย้ายก๊วน = เพิ่มเข้าก๊วนใหม่ แล้วเลือกก๊วนเดิมกด “เอาออก”
          </p>
        </div>
      )}

      {msg && <p className="text-xs text-emerald-400">{msg}</p>}

      <ul className="divide-y divide-white/5">
        {list.map((p) => {
          const on = sel.has(p.id);
          return (
            <li key={p.id}>
              <button
                onClick={() => toggle(p.id)}
                className="flex w-full items-center gap-3 py-2.5 text-left"
              >
                <span
                  className={
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-[11px] " +
                    (on ? "border-court bg-court text-white" : "border-white/20 text-transparent")
                  }
                >
                  ✓
                </span>
                {p.avatarUrl ? (
                  <Image src={p.avatarUrl} alt="" width={30} height={30} className="rounded-full" />
                ) : (
                  <span className="h-[30px] w-[30px] rounded-full bg-surface-overlay flex items-center justify-center text-sm">
                    🏀
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm">{p.nickname}</span>
                  {p.groupIds.length > 0 ? (
                    <span className="block truncate text-[11px] text-ink-faint">
                      {p.groupIds.map(nameOf).join(", ")}
                    </span>
                  ) : (
                    <span className="block text-[11px] text-amber-400">ยังไม่เลือกก๊วน</span>
                  )}
                </div>
              </button>
            </li>
          );
        })}
        {list.length === 0 && (
          <li className="py-6 text-center text-sm text-ink-faint">ไม่พบผู้เล่น</li>
        )}
      </ul>
    </div>
  );
}

function Chip({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "h-9 rounded-full px-3.5 text-sm font-semibold transition " +
        (on ? "bg-court text-white" : "bg-surface-overlay text-ink-dim hover:text-ink")
      }
    >
      {children}
    </button>
  );
}
