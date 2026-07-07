"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext, requireUser } from "@/features/auth/guards";
import { youtubeId } from "./lib/youtube";

export interface ActionState {
  error?: string;
}

/** แปะ/ลบลิงก์ YouTube ให้แมตช์ (สมาชิกทุกคนช่วยกันได้ เหมือนการกรอกสถิติ) */
export async function setMatchVideo(
  matchId: string,
  gameId: string,
  url: string
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const trimmed = url.trim();
  if (trimmed && !youtubeId(trimmed)) {
    return { error: "ลิงก์ YouTube ไม่ถูกต้อง — วางลิงก์จาก YouTube อีกครั้ง" };
  }
  const { error } = await supabase
    .from("matches")
    .update({ video_url: trimmed || null })
    .eq("id", matchId)
    .eq("game_id", gameId);
  if (error) return { error: "บันทึกลิงก์ไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath(`/games/${gameId}/videos`);
  return {};
}

/** Called after the client finishes uploading to storage. */
export async function registerVideo(
  gameId: string,
  path: string,
  sizeBytes: number
): Promise<ActionState> {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะผู้ดูแลก๊วนเท่านั้น" };

  const { data: video, error } = await supabase
    .from("videos")
    .insert({
      game_id: gameId,
      uploaded_by: user.id,
      storage_path: path,
      size_bytes: sizeBytes,
      status: "queued",
    })
    .select("id")
    .single();
  if (error || !video) return { error: "บันทึกวิดีโอไม่สำเร็จ" };

  // AI-ready: job queued now, GPU worker picks it up in Phase 3
  await supabase.from("ai_analysis_jobs").insert({
    video_id: video.id,
    status: "queued",
    params: { pipeline: "v1", requested_by: user.id },
  });

  revalidatePath(`/games/${gameId}/videos`);
  return {};
}

export async function deleteVideo(
  videoId: string,
  gameId: string,
  storagePath: string
) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return;

  await supabase.storage.from("videos").remove([storagePath]);
  await supabase.from("videos").delete().eq("id", videoId);

  revalidatePath(`/games/${gameId}/videos`);
}
