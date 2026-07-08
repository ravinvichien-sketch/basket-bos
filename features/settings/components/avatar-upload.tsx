"use client";

import { useActionState, useRef, useState } from "react";
import Image from "next/image";
import { updateAvatar, type ActionState } from "../actions";

export function AvatarUpload({
  currentUrl,
}: {
  currentUrl: string | null;
}) {
  const ref = useRef<HTMLFormElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [state, action, pending] = useActionState<ActionState, FormData>(
    updateAvatar,
    {}
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPreview(URL.createObjectURL(file));
    }
  };

  return (
    <form action={action} ref={ref} className="space-y-3">
      <label className="block">
        <div className="flex items-center gap-4 cursor-pointer group">
          <div className="relative w-16 h-16 rounded-full overflow-hidden bg-surface-overlay ring-2 ring-white/10 group-hover:ring-court/50 transition">
            {(preview || currentUrl) ? (
              <Image
                src={preview || currentUrl!}
                alt="avatar"
                width={64}
                height={64}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-lg">
                👤
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">รูปโปรไฟล์</p>
            <p className="text-xs text-ink-faint">แตะเพื่อเปลี่ยนรูป</p>
          </div>
        </div>
        <input
          type="file"
          name="avatar"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFileChange(e);
            e.target.form?.requestSubmit();
          }}
        />
      </label>
      {pending && <p className="text-xs text-ink-dim">⏳ กำลังอัปโหลด...</p>}
      {state.error && (
        <p className="text-xs text-red-400">{state.error}</p>
      )}
    </form>
  );
}
