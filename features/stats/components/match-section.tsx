"use client";

import { useActionState } from "react";
import { saveMatch, deleteMatch, type ActionState } from "../actions";
import { cn } from "@/lib/utils";

export interface TeamOption {
  id: string;
  name: string;
  color: string;
}

export interface MatchView {
  id: string;
  team_a: string | null;
  team_b: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
  is_warmup: boolean;
}

export function MatchSection({
  gameId,
  teams,
  matches,
  isAdmin,
}: {
  gameId: string;
  teams: TeamOption[];
  matches: MatchView[];
  isAdmin: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveMatch.bind(null, gameId),
    {}
  );

  const teamName = (id: string | null, stored: string | null) =>
    stored ?? (id ? (teams.find((t) => t.id === id)?.name ?? "ทีม") : "ทีม");
  const teamColor = (id: string | null) =>
    (id && teams.find((t) => t.id === id)?.color) || "#94a3b8";

  const selectCls =
    "h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-court";
  const scoreCls =
    "h-11 w-16 rounded-xl bg-surface-overlay border border-white/10 px-2 text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-court";

  return (
    <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-ink-dim">
        ผลการแข่ง
      </h3>

      {matches.length > 0 && (
        <ul className="divide-y divide-white/5">
          {matches.map((m) => {
            const aWins = m.score_a > m.score_b;
            const bWins = m.score_b > m.score_a;
            return (
              <li key={m.id} className="flex items-center gap-2 py-2.5 text-sm">
                {m.is_warmup && (
                  <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                    วอร์มอัพ
                  </span>
                )}
                <span
                  className={cn("flex-1 text-right truncate", aWins && "font-bold")}
                  style={{ color: aWins ? teamColor(m.team_a) : undefined }}
                >
                  {aWins && "🏆 "}
                  {teamName(m.team_a, m.team_a_name)}
                </span>
                <span className="shrink-0 rounded-lg bg-surface-overlay px-3 py-1 font-black tabular-nums">
                  {m.score_a} - {m.score_b}
                </span>
                <span
                  className={cn("flex-1 truncate", bWins && "font-bold")}
                  style={{ color: bWins ? teamColor(m.team_b) : undefined }}
                >
                  {teamName(m.team_b, m.team_b_name)}
                  {bWins && " 🏆"}
                </span>
                {isAdmin && (
                  <form action={deleteMatch.bind(null, m.id, gameId)}>
                    <button
                      aria-label="ลบ"
                      className="h-6 w-6 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25"
                    >
                      ✕
                    </button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {teams.length >= 2 ? (
        <form action={formAction} className="space-y-2">
          <div className="flex items-center gap-2">
            <select name="team_a" required defaultValue="" className={selectCls}>
              <option value="" disabled>
                ทีม A
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <input
              name="score_a"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              required
              className={scoreCls}
            />
            <span className="text-ink-faint text-sm">vs</span>
            <input
              name="score_b"
              type="number"
              inputMode="numeric"
              min={0}
              placeholder="0"
              required
              className={scoreCls}
            />
            <select name="team_b" required defaultValue="" className={selectCls}>
              <option value="" disabled>
                ทีม B
              </option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2 text-xs text-ink-dim">
            <input
              type="checkbox"
              name="is_warmup"
              value="1"
              className="h-4 w-4 accent-court"
            />
            เกมส์วอร์มอัพ (ทีมยังมาไม่ครบ — สถิติยังนับ)
          </label>
          <button
            type="submit"
            disabled={pending}
            className="w-full h-11 rounded-xl bg-court text-white text-sm font-bold hover:bg-court-dark transition disabled:opacity-50"
          >
            {pending ? "กำลังบันทึก..." : "บันทึกผลเกมส์ 🏆"}
          </button>
          {state.error && (
            <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-2.5 text-center">
              {state.error}
            </p>
          )}
        </form>
      ) : (
        <p className="py-3 text-center text-xs text-ink-faint">
          จัดทีมก่อน แล้วค่อยบันทึกผลแข่งได้
        </p>
      )}
    </div>
  );
}
