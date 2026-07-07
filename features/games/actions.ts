"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getAdminContext,
  getGameEditorContext,
  canManageGroup,
} from "@/features/auth/guards";
import { pushToAllMembers } from "@/features/notifications/line";
import { generateAndSendSummary } from "@/features/games/lib/send-summary";
import { formatThaiDateTime } from "@/lib/format";
import { gameSchema } from "./schemas";
import { STATUS_TRANSITIONS } from "./constants";
import type { GameStatus } from "@/types/database";

export interface ActionState {
  error?: string;
}

function parseGameForm(formData: FormData) {
  return gameSchema.safeParse({
    group_id: formData.get("group_id"),
    title: formData.get("title"),
    location: formData.get("location"),
    starts_at: formData.get("starts_at"),
    ends_at: formData.get("ends_at"),
    reg_opens_at: formData.get("reg_opens_at"),
    reg_deadline: formData.get("reg_deadline"),
    fee_mode: formData.get("fee_mode") ?? "split",
    court_fee_thb: formData.get("court_fee_thb"),
    max_players: formData.get("max_players"),
    max_waitlist: formData.get("max_waitlist"),
    notes: formData.get("notes"),
    game_duration_minutes: formData.get("game_duration_minutes"),
    target_score: formData.get("target_score"),
  });
}

export async function createGame(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, user } = await getAdminContext();

  const parsed = parseGameForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;

  if (!(await canManageGroup(d.group_id))) {
    return { error: "คุณไม่มีสิทธิ์สร้างนัดในก๊วนนี้" };
  }

  const { data: game, error } = await supabase
    .from("games")
    .insert({
      created_by: user.id,
      group_id: d.group_id,
      title: d.title,
      location: d.location,
      starts_at: d.starts_at.toISOString(),
      ends_at: d.ends_at.toISOString(),
      reg_opens_at: d.reg_opens_at.toISOString(),
      reg_deadline: d.reg_deadline.toISOString(),
      fee_mode: d.fee_mode,
      court_fee_thb: d.court_fee_thb,
      max_players: d.max_players,
      max_waitlist: d.max_waitlist,
      notes: d.notes || null,
      game_duration_minutes: d.game_duration_minutes ?? 8,
      target_score: d.target_score || null,
      status: formData.get("publish") === "1" ? "open" : "draft",
    })
    .select("id")
    .single();

  if (error || !game) return { error: "สร้าง Session ไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/games");
  redirect(`/games/${game.id}`);
}

export async function updateGame(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการนัดนี้" };

  const parsed = parseGameForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;
  // ห้ามย้ายนัดไปก๊วนที่ตัวเองไม่ได้เป็นแอดมิน
  if (!(await canManageGroup(d.group_id))) {
    return { error: "คุณไม่มีสิทธิ์กับก๊วนปลายทาง" };
  }

  const { error } = await supabase
    .from("games")
    .update({
      group_id: d.group_id,
      title: d.title,
      location: d.location,
      starts_at: d.starts_at.toISOString(),
      ends_at: d.ends_at.toISOString(),
      reg_opens_at: d.reg_opens_at.toISOString(),
      reg_deadline: d.reg_deadline.toISOString(),
      fee_mode: d.fee_mode,
      court_fee_thb: d.court_fee_thb,
      max_players: d.max_players,
      max_waitlist: d.max_waitlist,
      notes: d.notes || null,
      game_duration_minutes: d.game_duration_minutes ?? 8,
      target_score: d.target_score || null,
    })
    .eq("id", gameId);

  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  redirect(`/games/${gameId}`);
}

export async function changeGameStatus(gameId: string, next: GameStatus) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;

  const { data: game } = await supabase
    .from("games")
    .select("status, title, starts_at, location")
    .eq("id", gameId)
    .single();
  if (!game) return;

  const allowed = STATUS_TRANSITIONS[game.status as GameStatus] ?? [];
  if (!allowed.includes(next)) return;

  await supabase.from("games").update({ status: next }).eq("id", gameId);

  if (next === "open") {
    try {
      await pushToAllMembers(
        `🏀 เปิดรับสมัครแล้ว!\n"${game.title}"\n📅 ${formatThaiDateTime(game.starts_at)}\n📍 ${game.location}\nรีบลงชื่อก่อนเต็ม 20 คน!`,
        "game_open"
      );
    } catch {
      // best-effort
    }
  }

  if (next === "completed") {
    generateAndSendSummary(gameId).catch(() => {});
  }

  revalidatePath("/games");
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/dashboard");
}

/** มอบ/คืนสิทธิ์คุมนัดนี้ชั่วคราว (ปล่อย null = คืน) — เฉพาะแอดมินตัวจริงของนัด */
export async function setActingAdmin(
  gameId: string,
  profileId: string | null
): Promise<ActionState> {
  const { supabase } = await getAdminContext();
  const { error } = await supabase.rpc("set_acting_admin", {
    p_game_id: gameId,
    p_profile_id: profileId,
  });
  if (error) {
    return {
      error: error.message?.includes("FORBIDDEN")
        ? "เฉพาะแอดมินของก๊วนนี้เท่านั้น"
        : "มอบสิทธิ์ไม่สำเร็จ",
    };
  }
  revalidatePath(`/games/${gameId}`);
  return {};
}

export async function deleteGame(gameId: string) {
  const { supabase } = await getAdminContext();
  // สิทธิ์ถูกบังคับที่ RPC (แอดมินเต็มระบบ หรือ แอดมินของก๊วนนั้น) — soft delete
  const { error } = await supabase.rpc("delete_game_session", {
    p_game_id: gameId,
  });
  if (error) return;

  revalidatePath("/games");
  revalidatePath("/groups");
  redirect("/games");
}
