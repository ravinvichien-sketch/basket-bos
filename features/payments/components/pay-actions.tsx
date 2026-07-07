"use client";

import { useState } from "react";

export function PayActions({
  promptpayId,
  bankName,
  bankNo,
  amount,
  qrSvg,
  payeeName,
}: {
  promptpayId: string | null;
  bankName: string | null;
  bankNo: string | null;
  amount: number;
  qrSvg: string | null;
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

  const svgToPngBlob = (svg: string): Promise<Blob | null> =>
    new Promise((resolve) => {
      const img = new window.Image();
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      img.onload = () => {
        const size = 512;
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        URL.revokeObjectURL(url);
        canvas.toBlob((b) => resolve(b), "image/png");
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });

  const shareOrSaveQr = async () => {
    if (!qrSvg) return;
    setQrSaved(false);
    const blob = await svgToPngBlob(qrSvg);
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

      {qrSvg && (
        <div className="space-y-1.5">
          <button
            onClick={shareOrSaveQr}
            className="h-11 w-full rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition"
          >
            {qrSaved ? "✅ บันทึก QR แล้ว" : "💾 บันทึก QR (หรือกดค้างที่ QR เพื่อบันทึก)"}
          </button>
          <p className="text-center text-[11px] text-ink-faint">
            บนมือถือกดค้างที่ QR → เลือก &ldquo;บันทึกรูป&rdquo; — หรือกดปุ่มด้านบนเพื่อแชร์เข้าแอปธนาคาร
          </p>
        </div>
      )}
    </div>
  );
}
