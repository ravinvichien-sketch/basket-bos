"use client";

import { useRef, useState, useTransition } from "react";
import { notifyPaid, uploadSlip } from "../actions";
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

      if (file.size > 5 * 1024 * 1024) {
        setError("รูปต้องไม่เกิน 5 MB");
        setUploading(false);
        return;
      }

      try {
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("อ่านไฟล์ไม่สำเร็จ"));
          reader.readAsDataURL(file);
        });

        const result = await uploadSlip(dataUrl);
        if ("error" in result) {
          setError(result.error);
          setUploading(false);
          return;
        }
        slipPath = result.path;
      } catch {
        setError("อัพโหลดสลิปไม่สำเร็จ กรุณาลองใหม่");
        setUploading(false);
        return;
      }

      setUploading(false);
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
