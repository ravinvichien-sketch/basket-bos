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

/** สลับภาษาแอป (ไทย/อังกฤษ) */
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
