"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Dashboard จ่ายเงินสด: Realtime + fallback รีเฟรชทุก 8 วิ */
export function RealtimePayments({ gameId }: { gameId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`game-pay-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payments",
          filter: `game_id=eq.${gameId}`,
        },
        () => router.refresh()
      )
      .subscribe();

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 8000);

    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [gameId, router]);

  return null;
}
