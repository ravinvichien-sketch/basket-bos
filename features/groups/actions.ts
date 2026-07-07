"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/features/auth/guards";
import { createClient } from "@/lib/supabase/server";
import { pushToProfiles } from "@/features/notifications/line";

export interface ActionState {
  error?: string;
}

/** Check if the current user is a group admin or super admin for a given group */
async function canManageGroup(supabase: Awaited<ReturnType<typeof createClient>>, groupId: string, userId: string, isAdmin: boolean): Promise<boolean> {
  if (isAdmin) return true;
  const { data: gm } = await supabase
    .from("group_members")
    .select("role")
    .eq("group_id", groupId)
    .eq("profile_id", userId)
    .maybeSingle();
  return gm?.role === "admin";
}

function revalidateGroups(groupId?: string) {
  revalidatePath("/groups");
  if (groupId) revalidatePath(`/groups/${groupId}`);
}

/** ใครก็ตามที่ลงทะเบียนแล้วสามารถตั้งก๊วนใหม่ได้ (ต้องมี LINE Group) */
export async function createGroup(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 60) return { error: "ใส่ชื่อก๊วน 1–60 ตัวอักษร" };
  const lineGroupId = String(formData.get("line_group_id") ?? "").trim();
  if (!lineGroupId) return { error: "กรุณาใส่ LINE Group ID" };

  const { supabase } = await getAdminContext();

  const { error } = await supabase.rpc("create_group", {
    p_name: name,
    p_line_group_id: lineGroupId,
  });
  if (error?.message?.includes("NOT_ONBOARDED")) {
    return { error: "กรุณาลงทะเบียนให้สมบูรณ์ก่อนตั้งก๊วน" };
  }
  if (error?.message?.includes("NO_LINE_GROUP")) {
    return { error: "กรุณาใส่ LINE Group ID" };
  }
  if (error?.message?.includes("LINE_GROUP_EXISTS")) {
    return { error: "LINE Group ID นี้ถูกใช้ไปแล้ว — แต่ละก๊วนต้องใช้ LINE Group แยกกัน" };
  }
  if (error) return { error: error.message };

  revalidateGroups();
  return {};
}

/** เปลี่ยนชื่อก๊วน (แอดมินก๊วนหรือแอดมินเต็มระบบ) */
export async function renameGroup(groupId: string, name: string) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!(await canManageGroup(supabase, groupId, user.id, isAdmin))) {
    return { error: "คุณไม่มีสิทธิ์จัดการก๊วนนี้" };
  }
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

/** แต่งตั้ง/ถอน แอดมินของก๊วน (แอดมินก๊วนหรือแอดมินเต็มระบบ) */
export async function setGroupAdmin(
  groupId: string,
  profileId: string,
  value: boolean
) {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!(await canManageGroup(supabase, groupId, user.id, isAdmin))) {
    return { error: "คุณไม่มีสิทธิ์จัดการก๊วนนี้" };
  }

  const { error } = await supabase.rpc("set_group_member_admin", {
    p_group_id: groupId,
    p_profile_id: profileId,
    p_value: value,
  });
  if (error) return { error: "อัปเดตสิทธิ์ไม่สำเร็จ" };
  revalidateGroups(groupId);
  return {};
}

// ── Group Location ──

export async function setGroupLocation(
  groupId: string,
  location: string,
  lat: number | null,
  lng: number | null
): Promise<ActionState> {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!(await canManageGroup(supabase, groupId, user.id, isAdmin))) {
    return { error: "คุณไม่มีสิทธิ์จัดการก๊วนนี้" };
  }

  const { error } = await supabase
    .from("groups")
    .update({ location: location || null, lat, lng })
    .eq("id", groupId);
  if (error) return { error: "บันทึกไม่สำเร็จ" };

  revalidateGroups(groupId);
  return {};
}

// ── Group Join Requests ──

export async function sendJoinRequest(
  groupId: string,
  message: string
): Promise<ActionState> {
  const { supabase, user } = await getAdminContext();

  const { error } = await supabase.from("group_join_requests").insert({
    group_id: groupId,
    requester_id: user.id,
    message: message || null,
  });
  if (error?.message?.includes("unique")) {
    return { error: "คุณส่งคำขอเข้าก๊วนนี้ไปแล้ว" };
  }
  if (error) return { error: "ส่งคำขอไม่สำเร็จ" };

  revalidatePath(`/groups/${groupId}`);
  return {};
}

export async function respondToJoinRequest(
  requestId: string,
  accept: boolean,
  groupId: string
): Promise<ActionState> {
  const { supabase, user, isAdmin } = await getAdminContext();
  if (!(await canManageGroup(supabase, groupId, user.id, isAdmin))) {
    return { error: "คุณไม่มีสิทธิ์จัดการก๊วนนี้" };
  }

  if (accept) {
    const { data: req } = await supabase
      .from("group_join_requests")
      .select("requester_id")
      .eq("id", requestId)
      .single();
    if (!req) return { error: "ไม่พบคำขอ" };

    await supabase.rpc("add_group_member", {
      p_group_id: groupId,
      p_profile_id: req.requester_id,
    });

    try {
      const { data: g } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();
      await pushToProfiles(
        [req.requester_id],
        `🎉 คุณได้รับการตอบรับเข้าก๊วน “${g?.name ?? ""}” แล้ว!`,
        "group_join_accepted"
      );
    } catch { /* best-effort */ }
  }

  const { error } = await supabase
    .from("group_join_requests")
    .update({
      status: accept ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
      responded_by: user.id,
    })
    .eq("id", requestId);
  if (error) return { error: "ตอบกลับไม่สำเร็จ" };

  revalidateGroups(groupId);
  revalidatePath(`/groups/${groupId}`);
  return {};
}

// ── Dream Teams ──

export async function createDreamTeam(
  name: string,
  memberIds: string[]
): Promise<ActionState & { id?: string }> {
  const { supabase, user } = await getAdminContext();
  const n = name.trim();
  if (!n || n.length > 60) return { error: "ชื่อทีม 1–60 ตัวอักษร" };

  // Check existing team count (max 3)
  const { count: myTeams } = await supabase
    .from("dream_teams")
    .select("*", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if ((myTeams ?? 0) >= 3) return { error: "คุณสร้าง Dream Team ได้สูงสุด 3 ทีม" };

  // Check total members (max 15 including owner)
  const totalMembers = [user.id, ...memberIds];
  const uniqueMembers = [...new Set(totalMembers)];
  if (uniqueMembers.length > 15) return { error: "Dream Team มีสมาชิกได้สูงสุด 15 คน" };

  const { data: dt, error } = await supabase
    .from("dream_teams")
    .insert({ name: n, owner_id: user.id })
    .select("id")
    .single();
  if (error) return { error: "สร้างทีมไม่สำเร็จ" };

  // Add owner as accepted + invite members
  const inserts = [
    { dream_team_id: dt.id, profile_id: user.id, status: "accepted" },
    ...memberIds.filter((id) => id !== user.id).map((id) => ({
      dream_team_id: dt.id,
      profile_id: id,
      status: "pending" as const,
    })),
  ];

  const { error: insError } = await supabase
    .from("dream_team_members")
    .insert(inserts);
  if (insError) return { error: "เพิ่มสมาชิกไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  return { id: dt.id };
}

export async function respondToDreamTeamInvite(
  memberId: string,
  accept: boolean,
  teamId: string
): Promise<ActionState> {
  const { supabase, user } = await getAdminContext();

  // Check max teams limit for the user (if accepting)
  if (accept) {
    const { data: userTeams } = await supabase
      .from("dream_team_members")
      .select("dream_team_id")
      .eq("profile_id", user.id)
      .eq("status", "accepted");
    if ((userTeams?.length ?? 0) >= 3) {
      return { error: "คุณเป็นสมาชิก Dream Team ได้สูงสุด 3 ทีม" };
    }

    // Check the team doesn't already have 15 accepted members
    const { count: teamCount } = await supabase
      .from("dream_team_members")
      .select("*", { count: "exact", head: true })
      .eq("dream_team_id", teamId)
      .eq("status", "accepted");
    if ((teamCount ?? 0) >= 15) {
      return { error: "ทีมนี้มีสมาชิกครบ 15 คนแล้ว" };
    }
  }

  const { error } = await supabase
    .from("dream_team_members")
    .update({
      status: accept ? "accepted" : "rejected",
      responded_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("profile_id", user.id);
  if (error) return { error: "ตอบกลับไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  return {};
}

export async function removeDreamTeamMember(
  teamId: string,
  profileId: string
): Promise<ActionState> {
  const { supabase, user } = await getAdminContext();

  // Only team owner can remove members
  const { data: team } = await supabase
    .from("dream_teams")
    .select("owner_id")
    .eq("id", teamId)
    .single();
  if (!team || team.owner_id !== user.id) {
    return { error: "คุณไม่ใช่เจ้าของทีมนี้" };
  }

  const { error } = await supabase
    .from("dream_team_members")
    .delete()
    .eq("dream_team_id", teamId)
    .eq("profile_id", profileId);
  if (error) return { error: "เอาออกไม่สำเร็จ" };

  revalidatePath(`/players/${user.id}`);
  return {};
}
