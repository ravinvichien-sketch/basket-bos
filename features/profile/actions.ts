"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { onboardingSchema } from "./schemas";

export interface ActionState {
  error?: string;
}

export async function completeOnboarding(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let positions: unknown = [];
  try {
    positions = JSON.parse((formData.get("positions") as string) || "[]");
  } catch {
    return { error: "ตำแหน่งไม่ถูกต้อง" };
  }

  // ก๊วนที่เลือก (ไม่บังคับ เลือกได้หลายก๊วน หรือไม่เลือกเลย)
  let groupIds: string[] = [];
  try {
    const raw = JSON.parse((formData.get("group_ids") as string) || "[]");
    if (Array.isArray(raw)) {
      groupIds = raw.filter((x): x is string => typeof x === "string");
    }
  } catch {
    groupIds = [];
  }

  const parsed = onboardingSchema.safeParse({
    nickname: formData.get("nickname"),
    height_cm: formData.get("height_cm"),
    weight_kg: formData.get("weight_kg"),
    birth_year: formData.get("birth_year"),
    dominant_hand: formData.get("dominant_hand"),
    positions,
    bio: formData.get("bio"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  const d = parsed.data;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      nickname: d.nickname,
      height_cm: d.height_cm,
      weight_kg: d.weight_kg,
      birth_year: d.birth_year,
      dominant_hand: d.dominant_hand,
      bio: d.bio || null,
      onboarded: true,
    })
    .eq("id", user.id);

  if (profileError) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  await supabase.from("player_positions").delete().eq("profile_id", user.id);
  const { error: posError } = await supabase.from("player_positions").insert(
    d.positions.map((position, i) => ({
      profile_id: user.id,
      position,
      priority: i + 1,
    }))
  );
  if (posError) return { error: "บันทึกตำแหน่งไม่สำเร็จ กรุณาลองใหม่" };

  // ผูกก๊วนที่เลือก (ถ้ามี) — best-effort ไม่บล็อคการสมัคร
  try {
    await supabase.rpc("set_my_groups", { p_group_ids: groupIds });
  } catch {
    // ไม่เป็นไร ผู้ใช้ตั้งก๊วนภายหลังได้
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function setCardPhoto(publicUrl: string): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const { error } = await supabase
    .from("profiles")
    .update({ card_photo_url: publicUrl })
    .eq("id", user.id);
  if (error) return { error: "บันทึกรูปไม่สำเร็จ" };

  revalidatePath("/profile");
  revalidatePath(`/players/${user.id}`);
  revalidatePath("/dashboard");
  return {};
}
