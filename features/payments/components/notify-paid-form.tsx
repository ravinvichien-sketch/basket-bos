"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { notifyPaid } from "../actions";
import { Button } from "@/components/ui/button";

export function NotifyPaidForm({
  paymentId,
  gameId,
}: {
  paymentId: string;
  gameId: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileRef.current?.files?.[0] ?? null;
    let slipPath: string | null = null;

    if (file) {
      setUploading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("กรุณาเข้าสู่ระบบใหม่");
        setUploading(false);
        return;
      }
      const ext = file.name.split(".").pop() ?? "jpg";
      slipPath = `${user.id}/${paymentId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("slips")
        .upload(slipPath, file);
      setUploading(false);
      if (uploadError) {
        setError("อัพโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
    }

    startTransition(async () => {
      const res = await notifyPaid(paymentId, gameId, slipPath);
      if (res?.error) setError(res.error);
    });
  }

  const busy = uploading || isPending;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <label className="block">
        <span className="block text-sm font-medium text-ink-dim mb-1.5">
          แนบสลิป (ไม่บังคับ)
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="block w-full text-sm text-ink-dim file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
        />
      </label>
      <Button type="submit" size="lg" disabled={busy}>
        {uploading
          ? "กำลังอัพโหลดสลิป..."
          : isPending
            ? "กำลังแจ้งโอน..."
            : "แจ้งโอนแล้ว ✓"}
      </Button>
      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
          {error}
        </p>
      )}
    </form>
  );
}
