"use client";

import { useActionState } from "react";
import { generateTeams, createEmptyTeams, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";

export function GenerateForm({
  gameId,
  hasTeams,
  locked,
}: {
  gameId: string;
  hasTeams: boolean;
  locked: boolean;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    generateTeams.bind(null, gameId),
    {}
  );
  const [emptyState, emptyAction, emptyPending] = useActionState<
    ActionState,
    FormData
  >(createEmptyTeams.bind(null, gameId), {});

  if (locked) return null;

  const busy = pending || emptyPending;
  const error = state.error ?? emptyState.error;

  return (
    <form action={formAction} className="space-y-2">
      <div className="flex gap-2">
        <select
          name="num_teams"
          defaultValue="4"
          className="h-12 w-24 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        >
          <option value="2">2 ทีม</option>
          <option value="3">3 ทีม</option>
          <option value="4">4 ทีม</option>
        </select>
        <Button type="submit" size="lg" disabled={busy} className="flex-1">
          {pending
            ? "กำลังจัดทีม..."
            : hasTeams
              ? "🎲 สุ่มทีมใหม่ทั้งหมด"
              : "⚖️ จัดทีมอัตโนมัติ"}
        </Button>
      </div>
      <button
        type="submit"
        formAction={emptyAction}
        disabled={busy}
        className="w-full h-11 rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition disabled:opacity-50"
      >
        ✋ สร้างทีมว่าง (จัดเองทีละคน)
      </button>
      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
          {error}
        </p>
      )}
    </form>
  );
}
