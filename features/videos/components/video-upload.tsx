"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { registerVideo } from "../actions";
import { Button } from "@/components/ui/button";

const MAX_SIZE = 1024 * 1024 * 1024; // 1GB (MVP — resumable upload lands with AI phase)

export function VideoUpload({ gameId }: { gameId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    setError(null);
    setMessage(null);
    if (!file) {
      setError("เลือกไฟล์วิดีโอก่อนครับ");
      return;
    }
    if (file.size > MAX_SIZE) {
      setError("ไฟล์ใหญ่เกิน 1GB — ตัดคลิปให้สั้นลงก่อนนะครับ");
      return;
    }

    setBusy(true);
    setMessage("กำลังอัพโหลด... (ไฟล์ใหญ่อาจใช้เวลาหลายนาที อย่าปิดหน้านี้)");
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "mp4";
      const path = `${gameId}/${Date.now()}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("videos")
        .upload(path, file, { contentType: file.type || "video/mp4" });
      if (upError) {
        setError("อัพโหลดไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      const res = await registerVideo(gameId, path, file.size);
      if (res?.error) {
        setError(res.error);
        return;
      }
      setMessage("อัพโหลดสำเร็จ ✓ เข้าคิววิเคราะห์ AI แล้ว");
      if (fileRef.current) fileRef.current.value = "";
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileRef}
        type="file"
        accept="video/*"
        className="block w-full text-sm text-ink-dim file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-2 file:text-sm file:font-semibold file:text-ink"
      />
      <Button size="lg" onClick={handleUpload} disabled={busy}>
        {busy ? "กำลังอัพโหลด..." : "อัพโหลดวิดีโอ 🎬"}
      </Button>
      {message && (
        <p className="rounded-xl bg-surface-overlay px-4 py-3 text-sm text-ink-dim text-center">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3 text-center">
          {error}
        </p>
      )}
    </div>
  );
}
