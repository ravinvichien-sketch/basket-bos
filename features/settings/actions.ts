"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ActionState {
  error?: string;
}

/** เปลี่ยน "ชื่อบนเสื้อ" (ชื่อที่โชว์ในแอป) — ทำได้ตลอดเวลา */
export async function updateJerseyName(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const name = String(formData.get("nickname") ?? "").trim();
  if (!name || name.length > 30) {
    return { error: "ชื่อบนเสื้อ 1–30 ตัวอักษร" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ nickname: name })
    .eq("id", user.id);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/", "layout");
  return {};
}

/** อัปโหลดรูปโปรไฟล์ */
export async function updateAvatar(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const file = formData.get("avatar") as File | null;
  if (!file) return { error: "กรุณาเลือกรูป" };
  if (file.size > 5 * 1024 * 1024) return { error: "รูปต้องไม่เกิน 5MB" };
  if (!file.type.startsWith("image/")) return { error: "ไฟล์ต้องเป็นรูปภาพ" };

  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/avatar-${Date.now()}.${ext}`;

  // remove old avatar if it was manually uploaded
  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_url")
    .eq("id", user.id)
    .single();
  if (profile?.avatar_url?.includes("supabase")) {
    const oldPath = profile.avatar_url.split("/").slice(-2).join("/");
    await supabase.storage.from("avatars").remove([oldPath]);
  }

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true });
  if (uploadError) return { error: "อัปโหลดไม่สำเร็จ" };

  const { data: publicUrlData } = supabase.storage
    .from("avatars")
    .getPublicUrl(path);

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrlData.publicUrl })
    .eq("id", user.id);
  if (dbError) {
    await supabase.storage.from("avatars").remove([path]);
    return { error: "บันทึกไม่สำเร็จ" };
  }

  revalidatePath("/", "layout");
  return {};
}
export async function setLanguage(lang: "th" | "en") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("profiles")
    .update({ lang: lang === "en" ? "en" : "th" })
    .eq("id", user.id);
  revalidatePath("/", "layout");
}
