"use client";

import { useState, useTransition } from "react";
import { setLanguage } from "../actions";
import { t, type Lang } from "@/lib/i18n";

export function LanguageToggle({ current }: { current: Lang }) {
  const [lang, setLang] = useState<Lang>(current);
  const [pending, start] = useTransition();

  const choose = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    start(async () => {
      await setLanguage(next);
    });
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold">{t(lang, "settings.language")}</label>
      <div className="grid grid-cols-2 gap-2">
        {(
          [
            ["th", t(lang, "settings.langTh")],
            ["en", t(lang, "settings.langEn")],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => choose(value)}
            disabled={pending}
            className={
              "h-11 rounded-xl border text-sm font-semibold transition disabled:opacity-60 " +
              (lang === value
                ? "border-court bg-court/15 text-court"
                : "border-white/10 bg-surface-overlay text-ink-dim")
            }
          >
            {lang === value && "✓ "}
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
