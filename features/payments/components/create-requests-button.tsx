"use client";

import { useActionState } from "react";
import { createPaymentRequests, type ActionState } from "../actions";
import { Button } from "@/components/ui/button";

export function CreateRequestsButton({
  gameId,
  perPlayer,
  playerCount,
}: {
  gameId: string;
  perPlayer: number;
  playerCount: number;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    createPaymentRequests.bind(null, gameId),
    {}
  );

  return (
    <form action={formAction} className="space-y-3">
      <Button type="submit" size="lg" disabled={pending}>
        {pending
          ? "กำลังสร้าง..."
          : `เปิดเก็บเงิน ${playerCount} คน × ฿${perPlayer.toLocaleString()}`}
      </Button>
      {state.error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3">
          {state.error}
        </p>
      )}
    </form>
  );
}
