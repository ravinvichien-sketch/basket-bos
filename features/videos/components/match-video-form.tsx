"use client";

import { useState, useTransition } from "react";
import { setMatchVideo } from "../actions";

/** ช่องแปะลิงก์ YouTube ของแมตช์หนึ่ง ๆ */
export function MatchVideoForm({
  matchId,
  gameId,
  initialUrl,
}: {
  matchId: string;
  gameId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const submit = () => {
    setError(null);
    setSaved(false);
    start(async () => {
      const res = await setMatchVideo(matchId, gameId, url);
      if (res?.error) setError(res.error);
      else setSaved(true);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex gap-2">
        <input
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setSaved(false);
          }}
          inputMode="url"
          placeholder="วางลิงก์ YouTube ของแมตช์นี้"
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        />
        <button
          onClick={submit}
          disabled={pending}
          className="h-10 rounded-xl bg-court px-4 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
        >
          {pending ? "..." : "บันทึก"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {saved && !error && (
        <p className="text-xs text-emerald-400">✓ บันทึกลิงก์แล้ว</p>
      )}
    </div>
  );
}
