"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * รายชื่อสดสำหรับทุกคนที่เปิดหน้าเกมอยู่:
 * 1) Supabase Realtime (เร็วสุด — เด้งทันที)
 * 2) Fallback: รีเฟรชทุก 8 วิ + ตอนสลับกลับมาที่แอป
 *    (กันกรณี websocket ถูกบล็อคในเบราว์เซอร์ของ LINE/บางเครือข่าย)
 */
export function RealtimeRegistrations({ gameId }: { gameId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`game-regs-${gameId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "registrations",
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
