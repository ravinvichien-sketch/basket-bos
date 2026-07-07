"use client";

import Image from "next/image";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { setCardPhoto } from "../actions";
import { cn } from "@/lib/utils";

type Mode = "direct" | "ai" | "cutout";

const AI_ENDPOINTS: Record<Exclude<Mode, "direct">, string> = {
  ai: "/api/ai/enhance-photo",
  cutout: "/api/ai/cutout-photo",
};

export function CardPhotoManager({
  currentPhotoUrl,
}: {
  currentPhotoUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  function onPick() {
    const file = fileRef.current?.files?.[0];
    setError(null);
    setStatus(null);
    setPreview(file ? URL.createObjectURL(file) : null);
  }

  async function upload(): Promise<{ path: string; url: string } | null> {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("เลือกรูปก่อนครับ");
      return null;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("รูปใหญ่เกิน 8MB");
      return null;
    }
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("กรุณาเข้าสู่ระบบใหม่");
      return null;
    }
    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${user.id}/card-${Date.now()}.${ext}`;
    const { error: upError } = await supabase.storage
      .from("avatars")
      .upload(path, file);
    if (upError) {
      setError("อัพโหลดไม่สำเร็จ กรุณาลองใหม่");
      return null;
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    return { path, url: publicUrl };
  }

  async function handle(mode: Mode) {
    setBusy(true);
    setError(null);
    try {
      setStatus("กำลังอัพโหลดรูป...");
      const uploaded = await upload();
      if (!uploaded) return;

      if (mode === "direct") {
        setStatus("กำลังบันทึก...");
        const res = await setCardPhoto(uploaded.url);
        if (res?.error) {
          setError(res.error);
          return;
        }
        setStatus("ตั้งเป็นรูปการ์ดแล้ว ✓");
      } else {
        setStatus(
          mode === "cutout"
            ? "✂️ AI กำลังตัดพื้นหลัง (อาจใช้เวลา ~1 นาที)..."
            : "✨ AI กำลังแต่งรูป (อาจใช้เวลา ~1 นาที)..."
        );
        const res = await fetch(AI_ENDPOINTS[mode], {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: uploaded.path }),
        });
        const json = await res.json();
        if (!res.ok) {
          setError(json.error ?? "AI ทำรูปไม่สำเร็จ");
          return;
        }
        setPreview(json.url);
        setStatus(
          mode === "cutout"
            ? "ตัดพื้นหลังเสร็จแล้ว ✓ ไปดูที่ “การ์ดโปร” ได้เลย"
            : "AI แต่งรูปเสร็จแล้ว ✓ ตั้งเป็นรูปการ์ดให้เลย"
        );
      }
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  const shown = preview ?? currentPhotoUrl;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {shown ? (
          <Image
            src={shown}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 rounded-xl object-cover border border-white/10"
            unoptimized
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-surface-overlay flex items-center justify-center text-3xl">
            📷
          </div>
        )}
        <div className="flex-1 text-sm text-ink-dim">
          รูปนี้จะขึ้นบนการ์ดนักบาสของคุณ
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={onPick}
            className="mt-2 block w-full text-xs text-ink-faint file:mr-3 file:rounded-lg file:border-0 file:bg-surface-overlay file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("direct")}
          className="h-11 rounded-xl bg-surface-overlay text-xs font-semibold hover:bg-surface-overlay/70 transition disabled:opacity-50"
        >
          ใช้รูปนี้เลย
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("ai")}
          className="h-11 rounded-xl bg-surface-overlay text-xs font-semibold hover:bg-surface-overlay/70 transition disabled:opacity-50"
        >
          ✨ AI แต่งรูป
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => handle("cutout")}
          className="h-11 rounded-xl bg-court text-white text-xs font-semibold hover:bg-court-dark transition disabled:opacity-50"
        >
          ✂️ AI ตัดพื้นหลัง
        </button>
      </div>
      <p className="text-xs text-ink-faint">
        ✂️ ตัดพื้นหลัง = ตัวลอยแบบโปสเตอร์ ใช้ในโหมด &ldquo;การ์ดโปร&rdquo;
        (แนะนำรูปเต็มตัว/ครึ่งตัวท่าเล่นบาส)
      </p>

      {status && (
        <p
          className={cn(
            "rounded-xl px-4 py-3 text-sm text-center",
            status.includes("✓")
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-surface-overlay text-ink-dim"
          )}
        >
          {status}
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
