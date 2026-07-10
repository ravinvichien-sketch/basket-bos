"use client";

import { useActionState, useRef, useState } from "react";
import { uploadGamePhoto } from "@/features/games/actions/photos";

export function PhotoUpload({ gameId }: { gameId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    uploadGamePhoto.bind(null, gameId),
    {}
  );
  const [driveUrl, setDriveUrl] = useState("");

  return (
    <form action={action} ref={ref} className="space-y-3">
      <label className="flex h-20 cursor-pointer items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-white/20 bg-surface-overlay/50 text-sm text-ink-dim hover:border-court/50 hover:text-court transition">
        <input
          type="file"
          name="photo"
          accept="image/*"
          multiple
          className="hidden"
          onChange={() => ref.current?.requestSubmit()}
        />
        {pending ? "⏳ กำลังอัปโหลด..." : "📸 + เลือกรูป (เลือกหลายรูปได้)"}
      </label>

      <div className="flex gap-2">
        <input
          type="url"
          name="drive_url"
          value={driveUrl}
          onChange={(e) => setDriveUrl(e.target.value)}
          placeholder="🔗 หรือวางลิงก์ Google Drive..."
          className="h-10 flex-1 rounded-xl bg-surface-overlay border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
          disabled={pending}
        />
        <button
          type="submit"
          disabled={pending || !driveUrl.trim()}
          className="h-10 shrink-0 rounded-xl bg-surface-highlight px-4 text-sm font-semibold text-white hover:bg-white/20 transition disabled:opacity-50"
        >
          {pending ? "..." : "เพิ่มลิงก์"}
        </button>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-500/10 text-red-400 text-sm px-3 py-2 text-center">
          {state.error}
        </p>
      )}
    </form>
  );
}
