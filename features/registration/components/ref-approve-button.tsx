"use client";

import { useTransition } from "react";
import { approveReferral } from "../actions";

/** ปุ่มให้ "ผู้ชวน" กดยืนยันว่าเป็นเพื่อนที่ตัวเองพามาจริง */
export function RefApproveButton({
  gameId,
  registrationId,
}: {
  gameId: string;
  registrationId: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() =>
        start(async () => {
          await approveReferral(gameId, registrationId);
        })
      }
      disabled={pending}
      className="rounded-lg bg-court/15 text-court px-2.5 py-1 text-xs font-semibold hover:bg-court/25 transition disabled:opacity-50"
    >
      {pending ? "..." : "ยืนยันว่าเพื่อนฉัน"}
    </button>
  );
}
