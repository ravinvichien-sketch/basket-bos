import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

/** Like requireUser but returns null instead of redirecting */
export async function tryGetUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

/** Returns supabase + user + isAdmin (แอดมินเต็มระบบ). Server-verified. */
export async function getAdminContext() {
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { supabase, user, isAdmin: profile?.role === "admin" };
}

/** true ถ้าผู้ใช้เป็นแอดมินของก๊วนนั้น (หรือแอดมินเต็มระบบ) */
async function isGroupAdminOf(
  supabase: Awaited<ReturnType<typeof createClient>>,
  groupId: string | null,
  userId: string
): Promise<boolean> {
  if (!groupId) return false;
  const { data } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", userId)
    .maybeSingle();
  return data?.role === "admin";
}

/**
 * สิทธิ์จัดการ "Session" นี้ = แอดมินเต็มระบบ หรือ แอดมินของก๊วนที่นัดสังกัด.
 * ใช้กับสร้าง/แก้/เปิด-ปิดนัด, จัดทีม, ตั้งคู่แข่ง ฯลฯ.
 */
export async function getGameEditorContext(gameId: string) {
  const { supabase, user, isAdmin } = await getAdminContext();
  const { data: game } = await supabase
    .from("games")
    .select("group_id, acting_admin_id")
    .eq("id", gameId)
    .single();

  // แอดมิน "ตัวจริง" ของ Session = แอดมินเต็มระบบ หรือ แอดมินก๊วนของ Session นั้น
  const isRealManager =
    isAdmin || (await isGroupAdminOf(supabase, game?.group_id ?? null, user.id));
  // ผู้ได้รับมอบสิทธิ์คุมเฉพาะ Session นี้ (acting admin) ก็จัดการได้
  const isActing = game?.acting_admin_id === user.id;
  return {
    supabase,
    user,
    isAdmin,
    isRealManager,
    canManage: isRealManager || isActing,
  };
}

/** สิทธิ์สร้าง Session ในก๊วนนี้ = แอดมินเต็มระบบ หรือ แอดมินของก๊วนนั้น. */
export async function canManageGroup(groupId: string): Promise<boolean> {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (isAdmin) return true;
  return isGroupAdminOf(supabase, groupId, user.id);
}

/**
 * ใครมีสิทธิ์ "แต่งตั้งคนเก็บเงิน" ของเกมนี้ = แอดมินเต็มระบบ
 * หรือ แอดมินของก๊วนที่ Session นั้นสังกัด (แยกก๊วน — ข้ามก๊วนไม่ได้).
 */
export async function getCollectorAdminContext(gameId: string) {
  const { supabase, user, isAdmin } = await getAdminContext();
  let canManageCollector = isAdmin;
  if (!isAdmin) {
    const { data: game } = await supabase
      .from("games")
      .select("group_id, acting_admin_id")
      .eq("id", gameId)
      .single();
    if (game?.acting_admin_id === user.id) {
      canManageCollector = true;
    } else if (game?.group_id) {
      const { data: gm } = await supabase
        .from("group_members")
        .select("role")
        .eq("group_id", game.group_id)
        .eq("profile_id", user.id)
        .maybeSingle();
      canManageCollector = gm?.role === "admin";
    }
  }
  return { supabase, user, isAdmin, canManageCollector };
}

/**
 * ผู้จัดการเรื่องเงินของเกม = แอดมิน หรือ "คนเก็บเงิน" ที่แอดมินแต่งตั้งไว้.
 * canManage ใช้คุมสิทธิ์ยืนยัน/ยกเว้น/เตือนยอดของเกมนั้น ๆ.
 */
export async function getGameManagerContext(gameId: string) {
  const { supabase, user, isAdmin } = await getAdminContext();
  let isCollector = false;
  if (!isAdmin) {
    const { data: game } = await supabase
      .from("games")
      .select("collector_profile_id")
      .eq("id", gameId)
      .single();
    isCollector = game?.collector_profile_id === user.id;
  }
  return { supabase, user, isAdmin, isCollector, canManage: isAdmin || isCollector };
}
