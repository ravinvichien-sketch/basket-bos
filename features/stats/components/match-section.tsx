"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMatch, deleteMatch, adminUpdateMatch, adminDeleteMatch, type ActionState } from "../actions";
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
  isSuperAdmin,
}: {
  gameId: string;
  teams: TeamOption[];
  matches: MatchView[];
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    saveMatch.bind(null, gameId),
    {}
  );

  const [editingMatch, setEditingMatch] = useState<string | null>(null);
  const [editTeamA, setEditTeamA] = useState("");
  const [editTeamB, setEditTeamB] = useState("");
  const [editScoreA, setEditScoreA] = useState("");
  const [editScoreB, setEditScoreB] = useState("");

  const [editError, setEditError] = useState<string | null>(null);
  const [editPending, startEdit] = useTransition();

  const handleEditSubmit = async (formData: FormData) => {
    setEditError(null);
    startEdit(async () => {
      await adminUpdateMatch(formData);
      setEditingMatch(null);
      setEditError(null);
    });
  };

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
                {isSuperAdmin && (
                  <>
                    <button
                      onClick={() => {
                        setEditingMatch(m.id);
                        setEditTeamA(m.team_a ?? "");
                        setEditTeamB(m.team_b ?? "");
                        setEditScoreA(String(m.score_a));
                        setEditScoreB(String(m.score_b));
                        setEditError(null);
                      }}
                      className="h-6 w-6 rounded-full bg-surface-overlay text-[11px] hover:bg-surface-overlay/70"
                    >
                      ✎
                    </button>
                    <form action={adminDeleteMatch.bind(null, m.id, gameId)}>
                      <button
                        aria-label="ลบแมตช์"
                        className="h-6 w-6 rounded-full bg-red-500/10 text-red-400 text-xs hover:bg-red-500/25"
                      >
                        ✕
                      </button>
                    </form>
                  </>
                )}
                {!isSuperAdmin && isAdmin && (
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

      {editingMatch && isSuperAdmin && (
        <form action={adminUpdateMatch} className="space-y-2 rounded-xl bg-amber-500/5 border border-amber-500/20 p-3">
          <p className="text-xs font-semibold text-amber-400">✎ แก้ไขผลแข่ง</p>
          <input type="hidden" name="match_id" value={editingMatch} />
          <div className="flex items-center gap-2">
            <select name="team_a" value={editTeamA} onChange={(e) => setEditTeamA(e.target.value)} required className={selectCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <input name="score_a" type="number" value={editScoreA} onChange={(e) => setEditScoreA(e.target.value)} required className={scoreCls} />
            <span className="text-ink-faint text-sm">vs</span>
            <input name="score_b" type="number" value={editScoreB} onChange={(e) => setEditScoreB(e.target.value)} required className={scoreCls} />
            <select name="team_b" value={editTeamB} onChange={(e) => setEditTeamB(e.target.value)} required className={selectCls}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 h-9 rounded-xl bg-court text-xs font-bold text-white hover:bg-court-dark transition">
              บันทึก
            </button>
            <button type="button" onClick={() => setEditingMatch(null)} className="h-9 rounded-xl bg-surface-overlay px-4 text-xs hover:bg-surface-overlay/70 transition">
              ยกเลิก
            </button>
          </div>
          {editError && <p className="text-xs text-red-400">{editError}</p>}
        </form>
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
