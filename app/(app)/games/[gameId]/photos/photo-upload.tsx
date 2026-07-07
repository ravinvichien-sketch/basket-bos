"use client";

import { useActionState, useRef } from "react";
import { uploadGamePhoto } from "@/features/games/actions/photos";

export function PhotoUpload({ gameId }: { gameId: string }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(
    uploadGamePhoto.bind(null, gameId),
    {}
  );

  return (
    <form
      action={action}
      onSubmit={() => setTimeout(() => ref.current?.reset(), 100)}
      ref={ref}
      className="space-y-2"
    >
      <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl2 border-2 border-dashed border-white/20 bg-surface-overlay/50 text-sm text-ink-dim hover:border-court/50 hover:text-court transition">
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          className="hidden"
          onChange={() => ref.current?.requestSubmit()}
        />
        {pending ? "⏳ กำลังอัปโหลด..." : "📸 + เพิ่มรูปภาพ"}
      </label>
      {state.error && (
        <p className="rounded-lg bg-red-500/10 text-red-400 text-sm px-3 py-2 text-center">
          {state.error}
        </p>
      )}
    </form>
  );
}
