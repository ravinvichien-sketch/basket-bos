"use client";

import { useState, useTransition } from "react";
import { sendJoinRequest } from "@/features/groups/actions";

export function JoinRequestButton({
  groupId,
  existingRequest,
}: {
  groupId: string;
  existingRequest: { id: string; status: string } | null;
}) {
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (existingRequest?.status === "pending") {
    return (
      <p className="rounded-xl bg-amber-500/15 text-amber-400 px-4 py-3 text-sm text-center">
        ⏳ รอแอดมินตอบรับ...
      </p>
    );
  }

  if (existingRequest?.status === "accepted" || sent) {
    return (
      <p className="rounded-xl bg-green-500/15 text-green-400 px-4 py-3 text-sm text-center">
        ✅ คุณเป็นสมาชิกก๊วนนี้แล้ว
      </p>
    );
  }

  if (existingRequest?.status === "rejected") {
    return (
      <p className="rounded-xl bg-red-500/10 text-red-400 px-4 py-3 text-sm text-center">
        ❌ คำขอถูกปฏิเสธ
      </p>
    );
  }

  const handleSend = () => {
    setError(null);
    start(async () => {
      const res = await sendJoinRequest(groupId, message);
      if (res.error) setError(res.error);
      else setSent(true);
    });
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-faint">
        ส่งคำขอเข้าก๊วนนี้ — แอดมินก๊วนจะได้รับการแจ้งเตือน
      </p>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="ข้อความถึงแอดมิน (ไม่บังคับ)"
        maxLength={500}
        rows={2}
        className="w-full rounded-xl bg-surface border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-court"
        disabled={pending}
      />
      <button
        onClick={handleSend}
        disabled={pending}
        className="w-full rounded-xl bg-court py-2 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
      >
        {pending ? "กำลังส่ง..." : "ส่งคำขอ"}
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
