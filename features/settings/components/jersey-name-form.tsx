"use client";

import { useActionState } from "react";
import { updateJerseyName, type ActionState } from "../actions";
import { t, type Lang } from "@/lib/i18n";

export function JerseyNameForm({
  lang,
  current,
}: {
  lang: Lang;
  current: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    updateJerseyName,
    {}
  );

  return (
    <form action={formAction} className="space-y-2">
      <label className="text-sm font-semibold">{t(lang, "settings.jerseyName")}</label>
      <p className="text-xs text-ink-faint">{t(lang, "settings.jerseyHint")}</p>
      <div className="flex gap-2">
        <input
          name="nickname"
          required
          maxLength={30}
          defaultValue={current}
          placeholder={t(lang, "settings.jerseyPlaceholder")}
          className="h-11 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          {pending ? t(lang, "common.saving") : t(lang, "common.save")}
        </button>
      </div>
      {state.error && <p className="text-xs text-red-400">{state.error}</p>}
    </form>
  );
}
