"use client";

import { useActionState, useEffect } from "react";
import { updateAiSettings } from "@/features/settings/actions";
import type { Lang } from "@/lib/i18n";
import { t } from "@/lib/i18n";

interface Props {
  lang: Lang;
  currentProvider: string;
}

const PROVIDERS = [
  { value: "default", label_th: "ค่าเริ่มต้น (Groq Llama 3 ฟรี)", label_en: "Default (Groq Llama 3 Free)" },
  { value: "groq", label_th: "Groq (Llama 3)", label_en: "Groq (Llama 3)" },
  { value: "gemini", label_th: "Google Gemini", label_en: "Google Gemini" },
  { value: "openai", label_th: "OpenAI (ChatGPT)", label_en: "OpenAI (ChatGPT)" },
  { value: "anthropic", label_th: "Anthropic (Claude)", label_en: "Anthropic (Claude)" },
];

export function AiSettingsForm({ lang, currentProvider }: Props) {
  const [state, formAction, pending] = useActionState(updateAiSettings, {});

  useEffect(() => {
    if (state.provider) {
      const toast = document.getElementById("ai-saved-toast");
      if (toast) {
        toast.classList.remove("opacity-0");
        toast.classList.add("opacity-100");
        setTimeout(() => {
          toast.classList.remove("opacity-100");
          toast.classList.add("opacity-0");
        }, 2500);
      }
    }
  }, [state.provider]);

  return (
    <form action={formAction} className="space-y-4">
      <h3 className="font-bold text-base">{t(lang, "settings.ai_title")}</h3>
      <p className="text-xs text-ink-faint">{t(lang, "settings.ai_desc")}</p>

      <div>
        <label className="text-xs font-medium block mb-1">{t(lang, "settings.ai_provider")}</label>
        <select
          name="provider"
          defaultValue={currentProvider}
          className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-sm border border-white/10"
        >
          {PROVIDERS.map((p) => (
            <option key={p.value} value={p.value}>
              {lang === "th" ? p.label_th : p.label_en}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium block mb-1">
          {t(lang, "settings.ai_api_key")}
          <span className="text-ink-faint ml-1">({t(lang, "settings.ai_optional")})</span>
        </label>
        <input
          name="apiKey"
          type="password"
          placeholder={t(lang, "settings.ai_key_placeholder")}
          className="w-full rounded-lg bg-surface-overlay px-3 py-2 text-sm border border-white/10"
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-accent text-white px-4 py-2 text-sm font-bold disabled:opacity-50"
      >
        {pending ? t(lang, "common.saving") : t(lang, "common.save")}
      </button>

      {state.error && (
        <p className="text-red-400 text-xs">{state.error}</p>
      )}

      <p
        id="ai-saved-toast"
        className="text-green-400 text-xs opacity-0 transition-opacity duration-300"
      >
        ✅ {t(lang, "settings.ai_saved")}
      </p>
    </form>
  );
}
