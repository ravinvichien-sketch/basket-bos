"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

  // ก๊วนที่เลือก (ไม่บังคับ — เลือกหรือข้ามไปก่อนได้)
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

  // ผูกก๊วนที่เลือก
  if (groupIds.length > 0) {
    const { error: groupError } = await supabase.rpc("set_my_groups", {
      p_group_ids: groupIds,
    });
    if (groupError) return { error: "ผูกก๊วนไม่สำเร็จ กรุณาลองใหม่" };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

/** ผู้ใช้เปลี่ยนก๊วนของตัวเอง (เพิ่ม/ลด) */
export async function setMyGroups(groupIds: string[]): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const { error } = await supabase.rpc("set_my_groups", {
    p_group_ids: groupIds,
  });
  if (error) return { error: "อัปเดตก๊วนไม่สำเร็จ" };

  revalidatePath("/profile");
  revalidatePath("/", "layout");
  return {};
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

// ── Comments ──

export async function addComment(
  targetId: string,
  content: string,
  parentId?: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const t = content.trim();
  if (!t || t.length > 500) return { error: "ข้อความ 1–500 ตัวอักษร" };

  const { error } = await supabase.from("profile_comments").insert({
    target_id: targetId,
    author_id: user.id,
    content: t,
    parent_id: parentId || null,
  });
  if (error) return { error: "ส่งข้อความไม่สำเร็จ" };

  revalidatePath(`/players/${targetId}`);
  return {};
}

export async function deleteComment(
  commentId: string,
  targetId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("profile_comments")
    .delete()
    .eq("id", commentId)
    .eq("author_id", user.id);
  if (error) return { error: "ลบไม่สำเร็จ" };

  revalidatePath(`/players/${targetId}`);
  return {};
}

// ── LINE ID ──

export async function saveLineId(
  lineId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("profiles")
    .update({ line_id: lineId || null })
    .eq("id", user.id);
  if (error) return { error: "บันทึกไม่สำเร็จ" };

  revalidatePath("/profile");
  revalidatePath(`/players/${user.id}`);
  return {};
}

// ── Dream Team ──

export async function sendDreamTeamRequest(
  targetId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };
  if (targetId === user.id) return { error: "ขอตัวเองไม่ได้" };

  const { error } = await supabase.from("dream_team_requests").insert({
    requester_id: user.id,
    target_id: targetId,
  });
  if (error?.message?.includes("unique")) {
    return { error: "คุณส่งคำขอไปแล้ว" };
  }
  if (error) return { error: "ส่งคำขอไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  revalidatePath(`/players/${targetId}`);
  return {};
}

export async function cancelDreamTeamRequest(
  requestId: string,
  targetId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("dream_team_requests")
    .delete()
    .eq("id", requestId)
    .eq("requester_id", user.id);
  if (error) return { error: "ยกเลิกไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  revalidatePath(`/players/${targetId}`);
  return {};
}

export async function respondToDreamTeamRequest(
  requestId: string,
  accept: boolean,
  requesterId: string
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("dream_team_requests")
    .update({
      status: accept ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("target_id", user.id);
  if (error) return { error: "ตอบกลับไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  revalidatePath(`/players/${requesterId}`);
  return {};
}
