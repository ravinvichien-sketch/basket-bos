"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminAddPlayers } from "../actions";

/** แอดมิน: ค้นหา + เลือกหลายคน แล้วดึงเข้าเกมทีเดียว */
export function AdminAddForm({
  gameId,
  candidates,
}: {
  gameId: string;
  candidates: { id: string; nickname: string }[];
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s
      ? candidates.filter((c) => c.nickname.toLowerCase().includes(s))
      : candidates;
    return list.slice(0, 40);
  }, [q, candidates]);

  if (candidates.length === 0) return null;

  const toggle = (id: string) =>
    setPicked((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const add = () => {
    if (picked.size === 0) return;
    setMsg(null);
    const ids = [...picked];
    start(async () => {
      const res = await adminAddPlayers(gameId, ids);
      if (res.error) setMsg(res.error);
      else {
        setMsg(`เพิ่ม ${res.added} คนแล้ว`);
        setPicked(new Set());
        setQ("");
        router.refresh();
      }
    });
  };

  return (
    <div className="mt-3 space-y-2">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="ค้นหาชื่อผู้เล่นเพื่อเพิ่มเข้าเกม..."
        className="h-11 w-full rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
      />
      <div className="max-h-56 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5">
        {filtered.length === 0 ? (
          <p className="py-4 text-center text-xs text-ink-faint">ไม่พบชื่อนี้</p>
        ) : (
          filtered.map((c) => {
            const on = picked.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-surface-overlay/50 transition"
              >
                <span
                  className={
                    "flex h-5 w-5 items-center justify-center rounded-md border text-[11px] " +
                    (on
                      ? "border-court bg-court text-white"
                      : "border-white/20 text-transparent")
                  }
                >
                  ✓
                </span>
                <span className="truncate">{c.nickname}</span>
              </button>
            );
          })
        )}
      </div>
      <button
        onClick={add}
        disabled={pending || picked.size === 0}
        className="h-11 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending
          ? "กำลังเพิ่ม..."
          : picked.size > 0
            ? `เพิ่มผู้เล่น ${picked.size} คน`
            : "เลือกผู้เล่นที่จะเพิ่ม"}
      </button>
      {msg && (
        <p
          className={
            "text-xs " +
            (msg.includes("แล้ว") ? "text-emerald-400" : "text-red-400")
          }
        >
          {msg}
        </p>
      )}
    </div>
  );
}
