"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareCardButton({ profileId }: { profileId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  async function uploadCard(): Promise<string | null> {
    const res = await fetch(`/api/card/${profileId}`);
    if (!res.ok) throw new Error("card failed");
    const blob = await res.blob();
    const formData = new FormData();
    formData.append("file", blob);
    const uploadRes = await fetch(`/api/upload-card/${profileId}`, {
      method: "POST",
      body: formData,
    });
    if (!uploadRes.ok) throw new Error("upload failed");
    const { publicUrl } = await uploadRes.json();
    return publicUrl;
  }

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/card/${profileId}`);
      if (!res.ok) throw new Error("card failed");
      const blob = await res.blob();
      const file = new File([blob], "basketbos-card.png", {
        type: "image/png",
      });

      // 1) Try Web Share API (shows LINE on mobile)
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; title?: string; text?: string; url?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        try {
          await nav.share({
            files: [file],
            title: "Basket Bos Player Card",
            text: "🏀 การ์ดนักบาสของผม!",
          });
          return;
        } catch {
          // user cancelled or web share failed — fall through
        }
      }

      // 2) Upload to storage → permanent URL
      const publicUrl = await uploadCard();
      setCardUrl(publicUrl);

      // 3) Open LINE share URL (desktop fallback)
      const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(
        `🏀 การ์ดนักบาสของผม! ดูได้ที่ ${publicUrl}`
      )}`;
      window.open(lineUrl, "_blank");
    } catch (e) {
      setError("สร้างการ์ดไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    setBusy(true);
    setError(null);
    try {
      let url = cardUrl;
      if (!url) url = await uploadCard();
      if (!url) { setError("สร้างลิงก์ไม่สำเร็จ"); return; }
      setCardUrl(url);
      await navigator.clipboard.writeText(url);
      setError(null);
      alert("✅ คัดลอกลิงก์แล้ว! ไปแปะแชร์ที่ LINE ได้เลย");
    } catch {
      setError("คัดลอกไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button size="lg" onClick={share} disabled={busy} className="flex-[2]">
          {busy ? "กำลังสร้าง..." : "📤 แชร์"}
        </Button>
        <Button
          size="lg"
          onClick={copyLink}
          disabled={busy}
          variant="secondary"
          className="flex-1"
        >
          🔗 คัดลอกลิงก์
        </Button>
      </div>
      {cardUrl && (
        <p className="text-center text-xs text-emerald-400">
          ✅ อัปโหลดการ์ดแล้ว! แชร์ลิงก์ไป LINE ได้เลย
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
