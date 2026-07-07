"use server";

import { revalidatePath } from "next/cache";
import { getAdminContext } from "@/features/auth/guards";
import { pushToProfiles } from "@/features/notifications/line";

export interface ActionState {
  error?: string;
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

  revalidatePath("/admin");
  return {};
}

/** แอดมินเต็มระบบ: แต่งตั้ง/ถอน แอดมินของก๊วนหนึ่ง ๆ */
export async function setGroupMemberAdmin(
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

  if (value) {
    try {
      const { data: g } = await supabase
        .from("groups")
        .select("name")
        .eq("id", groupId)
        .single();
      await pushToProfiles(
        [profileId],
        `🛡️ คุณได้รับแต่งตั้งเป็นแอดมินของก๊วน “${g?.name ?? ""}”\nตอนนี้คุณเลือกคนเก็บเงินของเกมในก๊วนนี้ได้ในหน้าจ่ายเงิน`,
        "group_admin_assigned"
      );
    } catch {
      // best-effort
    }
  }

  revalidatePath("/admin");
  return {};
}
