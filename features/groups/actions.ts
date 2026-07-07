"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/features/auth/guards";
import { pushToProfiles } from "@/features/notifications/line";

export interface ActionState {
  error?: string;
}

function revalidateGroups(groupId?: string) {
  revalidatePath("/groups");
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

/** แอดมินเต็มระบบ: สร้างก๊วนใหม่ */
export async function createGroup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "ใส่ชื่อก๊วน 1–60 ตัวอักษร" };

  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };

  const { error } = await supabase.rpc("create_group", { p_name: name });
  if (error) return { error: "สร้างก๊วนไม่สำเร็จ" };

  revalidateGroups();
  return {};
}

/** แอดมินเต็มระบบ: เปลี่ยนชื่อก๊วน */
export async function renameGroup(groupId: string, name: string) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };
  const n = name.trim();
  if (!n || n.length > 60) return { error: "ชื่อก๊วน 1–60 ตัวอักษร" };

  const { error } = await supabase.rpc("rename_group", {
    p_group_id: groupId,
    p_name: n,
  });
  if (error) return { error: "เปลี่ยนชื่อไม่สำเร็จ" };
  revalidateGroups(groupId);
  return {};
}

/** แอดมินเต็มระบบ: ลบก๊วน (ซ่อน ไม่ลบข้อมูลเกมเก่า) */
export async function deleteGroup(groupId: string) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };
  const { error } = await supabase.rpc("delete_group", { p_group_id: groupId });
  if (error) return { error: "ลบก๊วนไม่สำเร็จ" };
  revalidateGroups();
  return {};
}

/** แอดมิน/แอดมินก๊วน: เพิ่มสมาชิกเข้าก๊วน */
export async function addGroupMember(groupId: string, profileId: string) {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("add_group_member", {
    p_group_id: groupId,
    p_profile_id: profileId,
  });
  if (error) {
    return {
      error: error.message?.includes("FORBIDDEN")
        ? "คุณไม่มีสิทธิ์กับก๊วนนี้"
        : "เพิ่มสมาชิกไม่สำเร็จ",
    };
  }
  try {
    const { data: g } = await supabase
      .from("groups")
      .select("name")
      .eq("id", groupId)
      .single();
    await pushToProfiles(
      [profileId],
      `🏀 คุณถูกเพิ่มเข้าก๊วน “${g?.name ?? ""}” แล้ว`,
      "group_added"
    );
  } catch {
    // best-effort
  }
  revalidateGroups(groupId);
  return {};
}

/** แอดมิน/แอดมินก๊วน: เอาสมาชิกออกจากก๊วน */
export async function removeGroupMember(groupId: string, profileId: string) {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("remove_group_member", {
    p_group_id: groupId,
    p_profile_id: profileId,
  });
  if (error) {
    return {
      error: error.message?.includes("FORBIDDEN")
        ? "คุณไม่มีสิทธิ์เอาคนนี้ออก"
        : "เอาสมาชิกออกไม่สำเร็จ",
    };
  }
  revalidateGroups(groupId);
  return {};
}

/** Super Admin: เพิ่มผู้เล่นหลายคนเข้าก๊วนทีเดียว */
export async function assignPlayersToGroup(
  groupId: string,
  profileIds: string[]
): Promise<ActionState & { done?: number }> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };
  if (!groupId || profileIds.length === 0) return { error: "เลือกก๊วนและผู้เล่นก่อน" };

  let done = 0;
  for (const pid of profileIds.slice(0, 100)) {
    const { error } = await supabase.rpc("add_group_member", {
      p_group_id: groupId,
      p_profile_id: pid,
    });
    if (!error) done++;
  }
  revalidatePath("/admin/players");
  revalidateGroups(groupId);
  return { done };
}

/** Super Admin: เอาผู้เล่นหลายคนออกจากก๊วนทีเดียว */
export async function removePlayersFromGroup(
  groupId: string,
  profileIds: string[]
): Promise<ActionState & { done?: number }> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };
  if (!groupId || profileIds.length === 0) return { error: "เลือกก๊วนและผู้เล่นก่อน" };

  let done = 0;
  for (const pid of profileIds.slice(0, 100)) {
    const { error } = await supabase.rpc("remove_group_member", {
      p_group_id: groupId,
      p_profile_id: pid,
    });
    if (!error) done++;
  }
  revalidatePath("/admin/players");
  revalidateGroups(groupId);
  return { done };
}

/** แอดมินเต็มระบบ: แต่งตั้ง/ถอน แอดมินของก๊วน */
export async function setGroupAdmin(
  groupId: string,
  profileId: string,
  value: boolean
) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะแอดมินเต็มระบบเท่านั้น" };

  const { error } = await supabase.rpc("set_group_member_admin", {
    p_group_id: groupId,
    p_profile_id: profileId,
    p_value: value,
  });
  if (error) return { error: "อัปเดตสิทธิ์ไม่สำเร็จ" };
  revalidateGroups(groupId);
  return {};
}
