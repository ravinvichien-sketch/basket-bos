"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/features/auth/guards";

export async function uploadGamePhoto(
  gameId: string,
  prev: { error?: string },
  formData: FormData
): Promise<{ error?: string }> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  const files = formData.getAll("photo") as File[];

  if (files.length === 0) return { error: "กรุณาเลือกรูป" };

  // Check bucket exists
  const { data: buckets } = await admin.storage.listBuckets();
  const bucketExists = buckets?.some((b) => b.name === "game_photos");
  if (!bucketExists) {
    return { error: "ยังไม่ได้สร้างที่เก็บรูป — กรุณาแจ้งแอดมิน" };
  }

  let uploaded = 0;
  for (const file of files) {
    if (file.size > 10 * 1024 * 1024) continue;
    if (!file.type.startsWith("image/")) continue;

    const ext = file.name.split(".").pop() ?? "jpg";
    const path = `${gameId}/${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.${ext}`;

    const { error: uploadError } = await admin.storage
      .from("game_photos")
      .upload(path, file);

    if (uploadError) continue;

    const { error: dbError } = await admin
      .from("game_photos")
      .insert({ game_id: gameId, uploaded_by: user.id, storage_path: path });

    if (dbError) {
      await admin.storage.from("game_photos").remove([path]);
      continue;
    }
    uploaded++;
  }

  if (uploaded === 0) return { error: "อัปโหลดไม่สำเร็จ — ตรวจสอบขนาดรูป (สูงสุด 10MB)" };

  revalidatePath(`/games/${gameId}/photos`);
  return {};
}

export async function deleteGamePhoto(
  gameId: string,
  photoId: string,
  storagePath: string
) {
  const admin = createAdminClient();
  const client = await createClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return;

  const { data: photo } = await client
    .from("game_photos")
    .select("uploaded_by")
    .eq("id", photoId)
    .single();

  if (!photo) return;
  const { data: profile } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (photo.uploaded_by !== user.id && profile?.role !== "admin") return;

  await admin.storage.from("game_photos").remove([storagePath]);
  await admin.from("game_photos").delete().eq("id", photoId);
  revalidatePath(`/games/${gameId}/photos`);
}
