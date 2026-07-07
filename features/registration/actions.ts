"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushToProfiles, pushToGroup } from "@/features/notifications/line";

/** ส่งรายชื่อล่าสุดเข้ากลุ่ม LINE ของก๊วน (ถ้าผูกกลุ่มไว้แล้ว) */
async function pushRosterToGroup(gameId: string, headline: string) {
  try {
    const supabase = await createClient();
    const [{ data: game }, { data: regs }] = await Promise.all([
      supabase
        .from("games")
        .select("title, max_players, starts_at, location, notes, groups!group_id(name)")
        .eq("id", gameId)
        .single(),
      supabase
        .from("registrations")
        .select("status, profiles!profile_id(nickname)")
        .eq("game_id", gameId)
        .in("status", ["confirmed", "waitlisted", "tentative"])
        .order("registered_at", { ascending: true }),
    ]);
    if (!game) return;

    const nick = (r: { profiles: unknown }) =>
      (r.profiles as { nickname?: string } | null)?.nickname ?? "ผู้เล่น";
    const confirmed = (regs ?? []).filter((r) => r.status === "confirmed");
    const tentative = (regs ?? []).filter((r) => r.status === "tentative");
    const waitlist = (regs ?? []).filter((r) => r.status === "waitlisted");

    const group = game.groups as { name?: string } | null;
    const dateStr = new Date(game.starts_at).toLocaleDateString("th-TH", {
      weekday: "short", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    let text = `🏀 ${game.title}\n`;
    text += `${headline}\n`;
    if (group?.name) text += `🎯 ${group.name}\n`;
    text += `📅 ${dateStr}\n📍 ${game.location}\n`;
    if (game.notes) text += `📝 ${game.notes}\n`;
    text += `\n👥 ตัวจริง (${confirmed.length}/${game.max_players})\n`;
    text += confirmed.map((r, i) => `${i + 1}. ${nick(r)}`).join("\n") || "  -";
    if (tentative.length > 0) {
      text += `\n\n🤷 ไม่แน่นอน (${tentative.length})\n`;
      text += tentative.map((r, i) => `${i + 1}. ${nick(r)}`).join("\n");
    }
    if (waitlist.length > 0) {
      text += `\n\n⏳ สำรอง (${waitlist.length})\n`;
      text += waitlist.map((r, i) => `${i + 1}. ${nick(r)}`).join("\n");
    }
    await pushToGroup(text);
  } catch {
    // best-effort — never block the sign-up flow
  }
}

/** LINE-push anyone promoted from the waitlist in the last few seconds. */
async function notifyPromoted(gameId: string) {
  try {
    const supabase = await createClient();
    const since = new Date(Date.now() - 15_000).toISOString();
    const [{ data: promoted }, { data: game }] = await Promise.all([
      supabase
        .from("registrations")
        .select("profile_id")
        .eq("game_id", gameId)
        .eq("status", "confirmed")
        .gte("promoted_at", since),
      supabase.from("games").select("title").eq("id", gameId).single(),
    ]);
    if (promoted && promoted.length > 0) {
      await pushToProfiles(
        promoted.map((r) => r.profile_id),
        `🎉 คุณได้เลื่อนจากคิวสำรองขึ้นเป็นตัวจริงในเกม "${game?.title ?? ""}" แล้ว เจอกันในสนาม!`,
        "promoted"
      );
    }
  } catch {
    // push is best-effort — never block the cancellation flow
  }
}

export interface ActionState {
  error?: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "กรุณาเข้าสู่ระบบใหม่",
  GAME_NOT_FOUND: "ไม่พบเกมนี้",
  REG_CLOSED: "ยังไม่เปิดรับสมัคร หรือปิดรับไปแล้ว",
  ALREADY_REGISTERED: "คุณลงชื่อไปแล้ว",
  WAITLIST_FULL: "คิวสำรองเต็มแล้ว",
  NOT_REGISTERED: "คุณยังไม่ได้ลงชื่อในเกมนี้",
  DEADLINE_PASSED: "เลยเวลาถอนตัวแล้ว กรุณาติดต่อแอดมิน",
  FORBIDDEN: "คุณไม่มีสิทธิ์ทำรายการนี้",
  NOT_GUEST: "ลงชื่อแทนได้เฉพาะแขกเท่านั้น",
  REF_NOT_MEMBER: "ผู้ชวนต้องเป็นสมาชิกในก๊วน",
  NO_REF: "รายการนี้ไม่มีผู้ชวนให้อนุมัติ",
};

function mapError(message?: string): string {
  if (message) {
    for (const code of Object.keys(ERROR_MESSAGES)) {
      if (message.includes(code)) return ERROR_MESSAGES[code];
    }
  }
  return "เกิดข้อผิดพลาด กรุณาลองใหม่";
}

function revalidateGame(gameId: string) {
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/games");
  revalidatePath("/dashboard");
}

export async function joinGame(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_player", {
    p_game_id: gameId,
  });
  if (error) return { error: mapError(error.message) };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", user.id)
        .single()
    : { data: null };
  await pushRosterToGroup(gameId, `➕ ${me?.nickname ?? "สมาชิก"} ลงชื่อแล้ว`);

  revalidateGame(gameId);
  return {};
}

export async function leaveGame(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_registration", {
    p_game_id: gameId,
  });
  if (error) return { error: mapError(error.message) };
  await notifyPromoted(gameId);
  await pushRosterToGroup(gameId, "➖ มีคนถอนตัว (สำรองเลื่อนขึ้นอัตโนมัติ)");
  revalidateGame(gameId);
  return {};
}

/** ลงชื่อแบบ "ไม่แน่นอน" — ไม่นับรวมในตัวจริง ไม่ขึ้น waitlist */
export async function registerMaybe(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบ" };

  const { error } = await supabase
    .from("registrations")
    .upsert(
      { game_id: gameId, profile_id: user.id, status: "tentative" },
      { onConflict: "game_id,profile_id" }
    );
  if (error) return { error: mapError(error.message) };

  revalidateGame(gameId);
  return {};
}

/** เปลี่ยนจาก "ไม่แน่นอน" → "ตัวจริง" (ถ้ายังมีที่) */
export async function confirmFromMaybe(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("register_player", {
    p_game_id: gameId,
  });
  if (error) return { error: mapError(error.message) };

  revalidateGame(gameId);
  return {};
}

/** พาเพื่อนมาเล่น: สมาชิกลงชื่อแทนเพื่อนที่ไม่มีบัญชี (guest) */
export async function addGuest(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const name = String(formData.get("guest_name") ?? "").trim();
  if (!name || name.length > 30) {
    return { error: "ใส่ชื่อเพื่อน 1–30 ตัวอักษร" };
  }
  // ผู้ชวน: ปล่อยว่าง = ตัวเราเอง (อนุมัติทันที) / เลือกคนอื่น = คนนั้นต้องกดอนุมัติ
  const refRaw = formData.get("ref_profile_id");
  const refProfileId =
    typeof refRaw === "string" && refRaw.length > 0 ? refRaw : null;
  const note =
    String(formData.get("note") ?? "")
      .trim()
      .slice(0, 60) || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  // สร้างโปรไฟล์แขก (ไม่มี LINE — ใช้บัญชีเงาภายในระบบ)
  const admin = createAdminClient();
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email: `guest-${randomUUID()}@guest.basketbos.local`,
      password: randomUUID(),
      email_confirm: true,
    });
  if (createError || !created) return { error: "สร้างแขกไม่สำเร็จ ลองใหม่" };

  const { error: profileError } = await admin.from("profiles").insert({
    id: created.user.id,
    line_user_id: `guest:${created.user.id}`,
    nickname: name,
    is_guest: true,
    onboarded: false,
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: "สร้างแขกไม่สำเร็จ ลองใหม่" };
  }

  // ลงคิวตามกติกาเดียวกับสมาชิก (FCFS / waitlist / เดดไลน์)
  const { error } = await supabase.rpc("register_guest", {
    p_game_id: gameId,
    p_profile_id: created.user.id,
    p_ref_profile_id: refProfileId,
    p_note: note,
  });
  if (error) {
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: mapError(error.message) };
  }

  // แจ้งผู้ชวนทาง LINE ให้มากดอนุมัติ (ถ้าอ้างคนอื่นเป็นผู้ชวน)
  if (refProfileId && refProfileId !== user.id) {
    try {
      const { data: g } = await supabase
        .from("games")
        .select("title")
        .eq("id", gameId)
        .single();
      await pushToProfiles(
        [refProfileId],
        `🙋 มีคนลงชื่อ "${name}" (แขก) โดยระบุว่าเป็นเพื่อนที่คุณชวนมาในเกม "${g?.title ?? ""}"\nเปิดแอปเพื่อกดยืนยันว่าคุณจะดูแลค่าใช้จ่ายของคนนี้`,
        "ref_approval_needed"
      );
    } catch {
      // best-effort
    }
  }

  await pushRosterToGroup(gameId, `➕ ${name} (แขก) ลงชื่อแล้ว`);
  revalidateGame(gameId);
  return {};
}

/** ผู้ชวนกดยืนยันว่าเป็นเพื่อนที่ตัวเองพามา (รับผิดชอบเรื่องเก็บเงิน) */
export async function approveReferral(gameId: string, registrationId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_referral", {
    p_registration_id: registrationId,
  });
  if (error) return { error: mapError(error.message) };
  revalidateGame(gameId);
  return {};
}

export async function adminRemovePlayer(gameId: string, profileId: string) {
  const supabase = await createClient();
  await supabase.rpc("cancel_registration", {
    p_game_id: gameId,
    p_profile_id: profileId,
  });
  await notifyPromoted(gameId);
  revalidateGame(gameId);
}

export async function adminAddPlayer(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const profileId = formData.get("profile_id");
  if (!profileId || typeof profileId !== "string") {
    return { error: "กรุณาเลือกผู้เล่น" };
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_player", {
    p_game_id: gameId,
    p_profile_id: profileId,
  });
  if (error) return { error: mapError(error.message) };
  revalidateGame(gameId);
  return {};
}

/** แอดมิน: ดึงผู้เล่นเข้าเกมทีเดียวหลายคน (จากใครก็ได้ในแอป) */
export async function adminAddPlayers(
  gameId: string,
  profileIds: string[]
): Promise<{ error?: string; added?: number }> {
  if (!profileIds || profileIds.length === 0) {
    return { error: "ยังไม่ได้เลือกผู้เล่น" };
  }
  const supabase = await createClient();
  let added = 0;
  let lastError: string | undefined;
  for (const id of profileIds.slice(0, 50)) {
    const { error } = await supabase.rpc("admin_add_player", {
      p_game_id: gameId,
      p_profile_id: id,
    });
    if (error) lastError = mapError(error.message);
    else added++;
  }
  revalidateGame(gameId);
  if (added === 0) return { error: lastError ?? "เพิ่มผู้เล่นไม่สำเร็จ" };
  return { added };
}
