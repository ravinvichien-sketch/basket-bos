"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getGameManagerContext } from "@/features/auth/guards";
import { pushToProfiles } from "@/features/notifications/line";

export interface ActionState {
  error?: string;
}

function revalidatePayments(gameId: string) {
  revalidatePath(`/games/${gameId}/payments`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/dashboard");
}

/** Player: upload slip image using admin client (bypasses RLS), returns the storage path. */
export async function uploadSlip(dataUrl: string): Promise<{ path: string } | { error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const base64 = dataUrl.split(",")[1];
  if (!base64) return { error: "ข้อมูลรูปไม่ถูกต้อง" };
  const buffer = Buffer.from(base64, "base64");
  const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage.from("slips").upload(path, buffer, {
    contentType: `image/${ext}`,
    upsert: false,
  });

  if (error) return { error: "อัพโหลดสลิปไม่สำเร็จ กรุณาลองใหม่" };
  return { path };
}

/** Admin/คนเก็บเงิน: create a payment row for every confirmed player (share = ceil(fee / n)). */
export async function createPaymentRequests(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const { supabase, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return { error: "เฉพาะแอดมินหรือคนเก็บเงินเท่านั้น" };

  const [{ data: game }, { data: confirmed }] = await Promise.all([
    supabase
      .from("games")
      .select("court_fee_thb, fee_mode")
      .eq("id", gameId)
      .single(),
    supabase
      .from("registrations")
      .select("profile_id")
      .eq("game_id", gameId)
      .eq("status", "confirmed"),
  ]);

  if (!game) return { error: "ไม่พบ Session" };
  if (game.court_fee_thb <= 0) return { error: "Session นี้ไม่มีค่าสนาม" };
  if (!confirmed || confirmed.length === 0) {
    return { error: "ยังไม่มีผู้เล่นตัวจริง" };
  }

  // fixed = ทุกคนจ่ายราคาเดียวกัน / split = หารค่าสนามรวมตามจำนวนคน
  const share =
    game.fee_mode === "fixed"
      ? game.court_fee_thb
      : Math.ceil(game.court_fee_thb / confirmed.length);

  const { error } = await supabase.from("payments").upsert(
    confirmed.map((r) => ({
      game_id: gameId,
      profile_id: r.profile_id,
      amount_thb: share,
    })),
    { onConflict: "game_id,profile_id", ignoreDuplicates: true }
  );
  if (error) return { error: "สร้างรายการเก็บเงินไม่สำเร็จ" };

  revalidatePayments(gameId);
  return {};
}

/** Player: "แจ้งโอนแล้ว" — optionally with an uploaded slip path. */
export async function notifyPaid(
  paymentId: string,
  gameId: string,
  slipPath: string | null
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const { error } = await supabase
    .from("payments")
    .update({
      status: "pending",
      ...(slipPath ? { slip_url: slipPath } : {}),
    })
    .eq("id", paymentId)
    .eq("profile_id", user.id);

  if (error) return { error: "แจ้งโอนไม่สำเร็จ กรุณาลองใหม่" };
  revalidatePayments(gameId);
  return {};
}

export async function confirmPayment(paymentId: string, gameId: string) {
  const { supabase, user, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return;
  await supabase
    .from("payments")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
      confirmed_by: user.id,
    })
    .eq("id", paymentId);
  revalidatePayments(gameId);
}

export async function waivePayment(paymentId: string, gameId: string) {
  const { supabase, user, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return;
  await supabase
    .from("payments")
    .update({ status: "waived", confirmed_by: user.id })
    .eq("id", paymentId);
  revalidatePayments(gameId);
}

/** Admin/คนเก็บเงิน: LINE-nudge everyone who hasn't paid yet. */
export async function remindUnpaid(gameId: string) {
  const { supabase, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return;

  const [{ data: game }, { data: unpaid }] = await Promise.all([
    supabase.from("games").select("title").eq("id", gameId).single(),
    supabase
      .from("payments")
      .select("profile_id, amount_thb")
      .eq("game_id", gameId)
      .eq("status", "unpaid"),
  ]);
  if (!unpaid || unpaid.length === 0) return;

  try {
    for (const p of unpaid) {
      await pushToProfiles(
        [p.profile_id],
        `💰 อย่าลืมจ่ายค่าสนามนะครับ\nSession "${game?.title ?? ""}" ยอดของคุณ ฿${p.amount_thb.toLocaleString()}\nเปิดแอปสแกน QR ได้เลย`,
        "payment_due"
      );
    }
  } catch {
    // best-effort
  }
}

export async function revertPayment(paymentId: string, gameId: string) {
  const { supabase, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return;
  await supabase
    .from("payments")
    .update({
      status: "unpaid",
      paid_at: null,
      confirmed_by: null,
    })
    .eq("id", paymentId);
  revalidatePayments(gameId);
}

/** Admin/คนเก็บเงิน: ลบยอด unpaid/pending ทั้งหมดของ Session นี้ แล้วสร้างยอดใหม่ตามค่าสนามที่แก้ไข */
export async function recalculatePaymentAmounts(
  gameId: string,
  _prev: ActionState,
  _formData: FormData
): Promise<ActionState> {
  const { supabase, canManage } = await getGameManagerContext(gameId);
  if (!canManage) return { error: "เฉพาะแอดมินหรือคนเก็บเงินเท่านั้น" };

  const [{ data: game }, { data: confirmed }] = await Promise.all([
    supabase
      .from("games")
      .select("court_fee_thb, fee_mode")
      .eq("id", gameId)
      .single(),
    supabase
      .from("registrations")
      .select("profile_id")
      .eq("game_id", gameId)
      .eq("status", "confirmed"),
  ]);

  if (!game) return { error: "ไม่พบ Session" };
  if (game.court_fee_thb <= 0) return { error: "Session นี้ไม่มีค่าสนาม" };
  if (!confirmed || confirmed.length === 0) {
    return { error: "ยังไม่มีผู้เล่นตัวจริง" };
  }

  // ลบยอด unpaid/pending ออกก่อน
  await supabase
    .from("payments")
    .delete()
    .eq("game_id", gameId)
    .in("status", ["unpaid", "pending"]);

  // สร้างยอดใหม่ด้วยจำนวนที่คำนวณใหม่
  const share =
    game.fee_mode === "fixed"
      ? game.court_fee_thb
      : Math.ceil(game.court_fee_thb / confirmed.length);

  const { error } = await supabase.from("payments").upsert(
    confirmed.map((r) => ({
      game_id: gameId,
      profile_id: r.profile_id,
      amount_thb: share,
    })),
    { onConflict: "game_id,profile_id", ignoreDuplicates: false }
  );

  if (error) return { error: "ปรับยอดไม่สำเร็จ" };

  revalidatePayments(gameId);
  return {};
}

/** แอดมิน/แอดมินก๊วน: แต่งตั้ง/เปลี่ยน "คนเก็บเงิน" ประจำ Session (ปล่อยว่าง = ยกเลิก).
 *  สิทธิ์ถูกบังคับที่ RPC (security definer) — แอดมินก๊วนแก้ได้เฉพาะ Session ในก๊วนตัวเอง
 *  และแก้ได้แค่ฟิลด์คนเก็บเงินเท่านั้น. */
export async function setCollector(gameId: string, profileId: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const { error } = await supabase.rpc("set_game_collector", {
    p_game_id: gameId,
    p_profile_id: profileId,
  });
  if (error) {
    return {
      error: error.message?.includes("FORBIDDEN")
        ? "คุณไม่มีสิทธิ์กับก๊วนนี้"
        : "แต่งตั้งคนเก็บเงินไม่สำเร็จ",
    };
  }

  if (profileId) {
    try {
      const { data: g } = await supabase
        .from("games")
        .select("title")
        .eq("id", gameId)
        .single();
      await pushToProfiles(
        [profileId],
        `💰 คุณถูกแต่งตั้งเป็นคนเก็บเงินของเกม "${g?.title ?? ""}"\nอย่าลืมใส่ PromptPay/เลขบัญชีของคุณในหน้าจ่ายเงิน เพื่อให้เพื่อน ๆ โอนเข้าได้เลย`,
        "collector_assigned"
      );
    } catch {
      // best-effort
    }
  }
  revalidatePayments(gameId);
  return {};
}

/** คนเก็บเงิน/สมาชิก: บันทึกข้อมูลรับเงินของตัวเอง (PromptPay + เลขบัญชี). */
export async function updatePayoutInfo(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "กรุณาเข้าสู่ระบบใหม่" };

  const promptpay = String(formData.get("promptpay_id") ?? "").trim();
  const bankName = String(formData.get("bank_name") ?? "").trim();
  const bankNo = String(formData.get("bank_account_no") ?? "").trim();

  if (!promptpay && !bankNo) {
    return { error: "กรุณากรอก PromptPay หรือเลขบัญชี อย่างใดอย่างหนึ่ง" };
  }

  // ตรวจ PromptPay เบื้องต้น: เบอร์ 10 หลัก หรือเลขบัตร ปชช. 13 หลัก
  if (promptpay) {
    const digits = promptpay.replace(/\D/g, "");
    if (digits.length !== 10 && digits.length !== 13) {
      return { error: "PromptPay ต้องเป็นเบอร์ 10 หลัก หรือเลขบัตรประชาชน 13 หลัก" };
    }
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      promptpay_id: promptpay || null,
      bank_name: bankName || null,
      bank_account_no: bankNo || null,
    })
    .eq("id", user.id);
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePayments(gameId);
  return {};
}
