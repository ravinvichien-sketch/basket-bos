"use client";

import { useState } from "react";

export function PayActions({
  promptpayId,
  bankName,
  bankNo,
  amount,
  qrDataUrl,
  payeeName,
}: {
  promptpayId: string | null;
  bankName: string | null;
  bankNo: string | null;
  amount: number;
  qrDataUrl: string | null;
  payeeName: string;
}) {
  const [copied, setCopied] = useState<string | null>(null);
  const [qrSaved, setQrSaved] = useState(false);

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard may be blocked — ignore
    }
  };

  const dataUrlToBlob = (dataUrl: string): Promise<Blob | null> =>
    new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });

  const copyQrImage = async () => {
    if (!qrDataUrl) return;
    const blob = await dataUrlToBlob(qrDataUrl);
    if (!blob) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ "image/png": blob }),
      ]);
      setCopied("qr");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // fallback: try share
      await shareOrSaveQr();
    }
  };

  const shareOrSaveQr = async () => {
    if (!qrDataUrl) return;
    setQrSaved(false);
    const blob = await dataUrlToBlob(qrDataUrl);
    if (!blob) return;
    const file = new File([blob], `promptpay-${amount}.png`, {
      type: "image/png",
    });
    const nav = navigator as Navigator & {
      canShare?: (d: { files: File[] }) => boolean;
      share?: (d: { files: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (nav.canShare?.({ files: [file] }) && nav.share) {
      try {
        await nav.share({
          files: [file],
          title: "PromptPay QR",
          text: `โอน ฿${amount.toLocaleString()} ให้ ${payeeName}`,
        });
        return;
      } catch {
        // user cancelled — fall through to download
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptpay-${amount}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setQrSaved(true);
    setTimeout(() => setQrSaved(false), 2000);
  };

  return (
    <div className="space-y-2">
      <button
        onClick={() => copy("amount", String(amount))}
        className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
      >
        <span className="text-ink-dim">ยอดที่ต้องโอน</span>
        <span className="tabular-nums">
          ฿{amount.toLocaleString()} {copied === "amount" ? "✓ คัดลอกแล้ว" : "📋"}
        </span>
      </button>

      {promptpayId && (
        <button
          onClick={() => copy("pp", promptpayId)}
          className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
        >
          <span className="text-ink-dim">PromptPay</span>
          <span className="tabular-nums">
            {promptpayId} {copied === "pp" ? "✓" : "📋"}
          </span>
        </button>
      )}

      {bankNo && (
        <button
          onClick={() => copy("bank", bankNo)}
          className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
        >
          <span className="text-ink-dim">{bankName ?? "บัญชี"}</span>
          <span className="tabular-nums">
            {bankNo} {copied === "bank" ? "✓" : "📋"}
          </span>
        </button>
      )}

      {qrDataUrl && (
        <div className="space-y-1.5">
          <button
            onClick={copyQrImage}
            className="flex h-11 w-full items-center justify-between rounded-xl bg-surface-overlay px-4 text-sm font-semibold hover:bg-surface-overlay/70 transition"
          >
            <span className="text-ink-dim">คัดลอกรูป QR</span>
            <span className="tabular-nums">
              {copied === "qr" ? "✅ คัดลอกแล้ว" : "📋"}
            </span>
          </button>
          <button
            onClick={shareOrSaveQr}
            className="h-11 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition"
          >
            {qrSaved ? "✅ บันทึก QR แล้ว" : "💾 บันทึก / แชร์ QR"}
          </button>
          <p className="text-center text-[11px] text-ink-faint">
            บนมือถือกดค้างที่ QR → เลือก &ldquo;บันทึกรูป&rdquo; — หรือกดปุ่มคัดลอกหรือแชร์
          </p>
        </div>
      )}
    </div>
  );
}
