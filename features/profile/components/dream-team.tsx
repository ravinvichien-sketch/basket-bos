"use client";

import { useTransition } from "react";
import {
  sendDreamTeamRequest,
  cancelDreamTeamRequest,
  respondToDreamTeamRequest,
} from "../actions";

export interface DreamTeamMember {
  profile_id: string;
  nickname: string;
}

/** Button "ขอเป็น Dream Team" on someone else's profile */
export function DreamTeamRequestButton({
  targetId,
  existingRequest,
}: {
  targetId: string;
  existingRequest: { id: string; status: string } | null;
}) {
  const [pending, start] = useTransition();

  if (existingRequest?.status === "accepted") {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-green-500/15 text-green-400 px-3 py-1.5 text-sm font-semibold">
        ✅ Dream Team
      </span>
    );
  }

  if (existingRequest?.status === "pending") {
    return (
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1 rounded-xl bg-amber-500/15 text-amber-400 px-3 py-1.5 text-sm">
          ⏳ รอตอบรับ...
        </span>
        <button
          onClick={() =>
            start(async () => { await cancelDreamTeamRequest(existingRequest.id, targetId); })
          }
          disabled={pending}
          className="rounded-lg bg-red-500/10 text-red-400 px-2 py-1 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
        >
          ยกเลิก
        </button>
      </div>
    );
  }

  if (existingRequest?.status === "rejected") {
    return (
      <span className="inline-flex items-center gap-1 rounded-xl bg-red-500/15 text-red-400 px-3 py-1.5 text-sm">
        ❌ ถูกปฏิเสธ
      </span>
    );
  }

  return (
    <button
      onClick={() => start(async () => { await sendDreamTeamRequest(targetId); })}
      disabled={pending}
      className="rounded-xl bg-court px-4 py-1.5 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
    >
      🤝 ขอ Dream Team
    </button>
  );
}

/** Accept/Reject buttons for incoming requests */
export function DreamTeamRespondButtons({
  requestId,
  requesterId,
}: {
  requestId: string;
  requesterId: string;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="flex gap-2">
      <button
        onClick={() =>
          start(async () => { await respondToDreamTeamRequest(requestId, true, requesterId); })
        }
        disabled={pending}
        className="rounded-lg bg-green-500/15 text-green-400 px-3 py-1 text-xs font-semibold hover:bg-green-500/25 transition disabled:opacity-50"
      >
        รับ
      </button>
      <button
        onClick={() =>
          start(async () => { await respondToDreamTeamRequest(requestId, false, requesterId); })
        }
        disabled={pending}
        className="rounded-lg bg-red-500/10 text-red-400 px-3 py-1 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
      >
        ปฏิเสธ
      </button>
    </div>
  );
}

/** List of accepted dream team members */
export function DreamTeamList({
  members,
}: {
  members: DreamTeamMember[];
}) {
  if (members.length === 0) return null;

  return (
    <ul className="divide-y divide-white/5">
      {members.map((m) => (
        <li key={m.profile_id} className="py-2 text-sm">
          🏀 {m.nickname}
        </li>
      ))}
    </ul>
  );
}
