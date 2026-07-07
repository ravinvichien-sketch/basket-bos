"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, getGameEditorContext } from "@/features/auth/guards";

export interface ActionState {
  error?: string;
  saved?: boolean;
}

const statLineSchema = z.object({
  profile_id: z.string().uuid(),
  minutes: z.number().int().min(0).max(300),
  fgm: z.number().int().min(0),
  fga: z.number().int().min(0),
  tpm: z.number().int().min(0),
  tpa: z.number().int().min(0),
  ftm: z.number().int().min(0),
  fta: z.number().int().min(0),
  assists: z.number().int().min(0),
  reb_off: z.number().int().min(0),
  reb_def: z.number().int().min(0),
  steals: z.number().int().min(0),
  blocks: z.number().int().min(0),
  turnovers: z.number().int().min(0),
  fouls: z.number().int().min(0),
  is_mvp: z.boolean(),
});

const payloadSchema = z.array(statLineSchema).max(60);

export async function saveGameStats(
  gameId: string,
  payloadJson: string
): Promise<ActionState> {
  // สมาชิกทุกคนช่วยกรอกสถิติข้างสนามได้
  const { supabase } = await requireUser();

  let parsed;
  try {
    parsed = payloadSchema.safeParse(JSON.parse(payloadJson));
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  if (!parsed.success) return { error: "ข้อมูลสถิติไม่ถูกต้อง" };

  // Sanity: made shots can't exceed attempts; only one MVP
  let mvpSeen = false;
  for (const s of parsed.data) {
    if (s.fgm < s.tpm || s.fga < s.fgm || s.tpa < s.tpm || s.fta < s.ftm) {
      return { error: "ตัวเลขชู้ตไม่สอดคล้องกัน" };
    }
    if (s.is_mvp) {
      if (mvpSeen) return { error: "เลือก MVP ได้คนเดียว" };
      mvpSeen = true;
    }
  }

  const rows = parsed.data.map((s) => ({
    game_id: gameId,
    ...s,
    points: 2 * s.fgm + s.tpm + s.ftm, // FGM includes 3PM; each 3 adds +1
    source: "manual" as const,
  }));

  const { error } = await supabase
    .from("player_game_stats")
    .upsert(rows, { onConflict: "game_id,profile_id" });
  if (error) return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { saved: true };
}

const matchSchema = z
  .object({
    team_a: z.string().uuid(),
    team_b: z.string().uuid(),
    score_a: z.coerce.number().int().min(0).max(500),
    score_b: z.coerce.number().int().min(0).max(500),
    is_warmup: z.coerce.boolean().optional().default(false),
  })
  .refine((d) => d.team_a !== d.team_b, {
    message: "เลือกคนละทีม",
    path: ["team_b"],
  });

/** บันทึกผลแข่ง 1 แมตช์ (ทีม vs ทีม) — สมาชิกทุกคนกรอกได้ */
export async function saveMatch(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const parsed = matchSchema.safeParse({
    team_a: formData.get("team_a"),
    team_b: formData.get("team_b"),
    score_a: formData.get("score_a"),
    score_b: formData.get("score_b"),
    is_warmup: formData.get("is_warmup") === "1",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }

  // snapshot ชื่อทีม — ประวัติอยู่ครบแม้ทีมถูกจัดใหม่ภายหลัง
  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [parsed.data.team_a, parsed.data.team_b]);
  const nameOf = (id: string) =>
    teamRows?.find((t) => t.id === id)?.name ?? null;

  const { error } = await supabase.from("matches").insert({
    game_id: gameId,
    ...parsed.data,
    team_a_name: nameOf(parsed.data.team_a),
    team_b_name: nameOf(parsed.data.team_b),
  });
  if (error) return { error: "บันทึกผลแข่งไม่สำเร็จ" };

  revalidatePath(`/games/${gameId}/stats`);
  return { saved: true };
}

const deltaSchema = z.object({
  profile_id: z.string().uuid(),
  fgm: z.number().int().min(0).max(200),
  fga: z.number().int().min(0).max(200),
  tpm: z.number().int().min(0).max(200),
  tpa: z.number().int().min(0).max(200),
  ftm: z.number().int().min(0).max(200),
  fta: z.number().int().min(0).max(200),
  assists: z.number().int().min(0).max(200),
  reb_off: z.number().int().min(0).max(200),
  reb_def: z.number().int().min(0).max(200),
  steals: z.number().int().min(0).max(200),
  blocks: z.number().int().min(0).max(200),
  turnovers: z.number().int().min(0).max(200),
  fouls: z.number().int().min(0).max(200),
});

const livePayloadSchema = z
  .object({
    team_a: z.string().uuid(),
    team_b: z.string().uuid(),
    score_a: z.number().int().min(0).max(500),
    score_b: z.number().int().min(0).max(500),
    lines: z.array(deltaSchema).max(40),
  })
  .refine((d) => d.team_a !== d.team_b, { message: "เลือกคนละทีม" });

/**
 * โหมดจดสกอร์สด: สร้างเกมส์ใหม่ใน Session นี้ + เริ่ม timer
 */
export async function startMatchGame(
  gameId: string,
  teamAId: string,
  teamBId: string
): Promise<ActionState & { matchId?: string }> {
  const { supabase } = await requireUser();

  const { data: game } = await supabase
    .from("games")
    .select("game_duration_minutes, target_score")
    .eq("id", gameId)
    .single();
  if (!game) return { error: "ไม่พบ Session" };

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [teamAId, teamBId]);
  const nameOf = (id: string) =>
    teamRows?.find((t) => t.id === id)?.name ?? null;

  const duration = (game.game_duration_minutes ?? 8) * 60;

  const { data: match, error } = await supabase
    .from("matches")
    .insert({
      game_id: gameId,
      team_a: teamAId,
      team_b: teamBId,
      team_a_name: nameOf(teamAId),
      team_b_name: nameOf(teamBId),
      status: "playing",
      timer_seconds: duration,
      timer_running: true,
      timer_started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: "เริ่มเกมส์ไม่สำเร็จ" };

  revalidatePath(`/games/${gameId}/live`);
  return { matchId: match.id };
}

/**
 * หยุด/ดำเนินการ timer ต่อ
 */
export async function toggleMatchTimer(
  matchId: string,
  remainingSeconds: number,
  running: boolean
): Promise<ActionState> {
  const { supabase } = await requireUser();

  if (running) {
    const { error } = await supabase
      .from("matches")
      .update({
        timer_running: true,
        timer_started_at: new Date().toISOString(),
        timer_seconds: remainingSeconds,
      })
      .eq("id", matchId);
    if (error) return { error: "ดำเนินการ timer ไม่สำเร็จ" };
  } else {
    const { error } = await supabase
      .from("matches")
      .update({
        timer_running: false,
        timer_seconds: remainingSeconds,
      })
      .eq("id", matchId);
    if (error) return { error: "หยุด timer ไม่สำเร็จ" };
  }

  return {};
}

/**
 * จบเกมส์: บันทึกสถิติ + อัปเดต match status
 */
export async function endMatchGame(
  matchId: string,
  gameId: string,
  payloadJson: string
): Promise<ActionState> {
  const { supabase } = await requireUser();

  let parsed;
  try {
    parsed = livePayloadSchema.safeParse(JSON.parse(payloadJson));
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;

  // Update match with final scores and status
  const { error: matchError } = await supabase
    .from("matches")
    .update({
      score_a: d.score_a,
      score_b: d.score_b,
      timer_running: false,
      status: "finished",
    })
    .eq("id", matchId);
  if (matchError) return { error: "บันทึกผลเกมส์ไม่สำเร็จ" };

  if (d.lines.length > 0) {
    const rows = d.lines.map((l) => {
      const fgm = l.fgm;
      const tpm = l.tpm;
      const ftm = l.ftm;
      return {
        game_id: gameId,
        match_id: matchId,
        profile_id: l.profile_id,
        minutes: 0,
        fgm,
        fga: l.fga,
        tpm,
        tpa: l.tpa,
        ftm,
        fta: l.fta,
        assists: l.assists,
        reb_off: l.reb_off,
        reb_def: l.reb_def,
        steals: l.steals,
        blocks: l.blocks,
        turnovers: l.turnovers,
        fouls: l.fouls,
        points: 2 * fgm + tpm + ftm,
        is_mvp: false,
        source: "manual" as const,
      };
    });

    const { error: statsError } = await supabase
      .from("player_game_stats")
      .insert(rows);
    if (statsError) return { error: "บันทึกสถิติผู้เล่นไม่สำเร็จ" };
  }

  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath(`/games/${gameId}/live`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { saved: true };
}

/**
 * โหมดจดสกอร์สด (legacy): บันทึกผลแมตช์ + สถิติรายคนของแมตช์นี้
 */
export async function saveLiveMatch(
  gameId: string,
  payloadJson: string
): Promise<ActionState> {
  const { supabase } = await requireUser();

  let parsed;
  try {
    parsed = livePayloadSchema.safeParse(JSON.parse(payloadJson));
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "ข้อมูลไม่ถูกต้อง" };
  }
  const d = parsed.data;

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [d.team_a, d.team_b]);
  const nameOf = (id: string) =>
    teamRows?.find((t) => t.id === id)?.name ?? null;

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      game_id: gameId,
      team_a: d.team_a,
      team_b: d.team_b,
      score_a: d.score_a,
      score_b: d.score_b,
      team_a_name: nameOf(d.team_a),
      team_b_name: nameOf(d.team_b),
      status: "finished",
    })
    .select("id")
    .single();
  if (matchError) return { error: "บันทึกผลแมตช์ไม่สำเร็จ" };

  if (d.lines.length > 0) {
    const rows = d.lines.map((l) => {
      const fgm = l.fgm;
      const tpm = l.tpm;
      const ftm = l.ftm;
      return {
        game_id: gameId,
        match_id: match.id,
        profile_id: l.profile_id,
        minutes: 0,
        fgm,
        fga: l.fga,
        tpm,
        tpa: l.tpa,
        ftm,
        fta: l.fta,
        assists: l.assists,
        reb_off: l.reb_off,
        reb_def: l.reb_def,
        steals: l.steals,
        blocks: l.blocks,
        turnovers: l.turnovers,
        fouls: l.fouls,
        points: 2 * fgm + tpm + ftm,
        is_mvp: false,
        source: "manual" as const,
      };
    });

    const { error: statsError } = await supabase
      .from("player_game_stats")
      .insert(rows);
    if (statsError) return { error: "บันทึกสถิติผู้เล่นไม่สำเร็จ" };
  }

  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath(`/games/${gameId}/live`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { saved: true };
}

/** นักกีฬาส่งสถิติของตัวเองย้อนหลัง (รออนุมัติ) */
export async function submitOwnStats(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const num = (k: string) => {
    const n = Math.round(Number(formData.get(k) ?? 0));
    return Number.isFinite(n) && n > 0 ? Math.min(n, 200) : 0;
  };
  const note = String(formData.get("note") ?? "").trim().slice(0, 100) || null;

  const { error } = await supabase.rpc("submit_own_stats", {
    p_game_id: gameId,
    p_points: num("points"),
    p_rebounds: num("rebounds"),
    p_assists: num("assists"),
    p_steals: num("steals"),
    p_blocks: num("blocks"),
    p_turnovers: num("turnovers"),
    p_note: note,
  });
  if (error) return { error: "ส่งสถิติไม่สำเร็จ กรุณาลองใหม่" };

  revalidatePath(`/games/${gameId}/stats`);
  return { saved: true };
}

/** แอดมินของนัด: อนุมัติ/ปฏิเสธ สถิติที่นักกีฬาส่งมา */
export async function reviewSubmission(
  submissionId: string,
  gameId: string,
  approve: boolean
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("review_stat_submission", {
    p_id: submissionId,
    p_approve: approve,
  });
  if (error) {
    return {
      error: error.message?.includes("FORBIDDEN")
        ? "เฉพาะแอดมินของนัดนี้เท่านั้น"
        : "ทำรายการไม่สำเร็จ",
    };
  }
  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath("/leaderboard");
  revalidatePath("/dashboard");
  return { saved: true };
}

/**
 * บันทึกเหตุการณ์เดียวในเกมส์ที่กำลังเล่น (ใช้โดยผู้ช่วยจดสถิติหลายคนพร้อมกัน)
 * —— upsert เข้า player_game_stats ตาม (game_id, match_id, profile_id)
 */
export async function recordMatchEvent(
  matchId: string,
  gameId: string,
  profileId: string,
  eventKey: string
): Promise<ActionState> {
  const { supabase } = await requireUser();

  // อนุญาตเฉพาะ admin / stat keeper
  const { data: game } = await supabase
    .from("games")
    .select("group_id, acting_admin_id, status")
    .eq("id", gameId)
    .single();
  if (!game || game.status === "completed") {
    return { error: "Session นี้จบแล้ว" };
  }
  if (game.status !== "in_progress") {
    return { error: "Session นี้ยังไม่เริ่มแข่ง" };
  }

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return { error: "ไม่พบผู้ใช้" };

  const isAdmin = (await supabase.from("profiles").select("role").eq("id", userId).single()).data?.role === "admin";
  const isGroupAdmin = (await supabase.from("group_members").select("role").eq("group_id", game.group_id).eq("profile_id", userId).single()).data?.role === "admin";
  const isActingAdmin = game.acting_admin_id === userId;
  const { count } = await supabase
    .from("game_stat_keepers")
    .select("profile_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("profile_id", userId);
  const isStatKeeper = (count ?? 0) > 0;

  if (!isAdmin && !isGroupAdmin && !isActingAdmin && !isStatKeeper) {
    return { error: "คุณไม่มีสิทธิ์จดสถิติใน Session นี้" };
  }

  // Compute delta for the event
  const delta = { fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0 };
  switch (eventKey) {
    case "make2": delta.fgm = 1; delta.fga = 1; break;
    case "make3": delta.fgm = 1; delta.fga = 1; delta.tpm = 1; delta.tpa = 1; break;
    case "makeFt": delta.ftm = 1; delta.fta = 1; break;
    case "miss": delta.fga = 1; break;
    // Stat chips don't change scoring, just add increment later
  }

  // Upsert: read existing, add delta, save
  const { data: existing } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("game_id", gameId)
    .eq("match_id", matchId)
    .eq("profile_id", profileId)
    .maybeSingle();

  const points = existing?.points ?? 0;
  const fgm = (existing?.fgm ?? 0) + delta.fgm;
  const fga = (existing?.fga ?? 0) + delta.fga;
  const tpm = (existing?.tpm ?? 0) + delta.tpm;
  const tpa = (existing?.tpa ?? 0) + delta.tpa;
  const ftm = (existing?.ftm ?? 0) + delta.ftm;
  const fta = (existing?.fta ?? 0) + delta.fta;

  // Stat chips: increment if event is a chip
  const assists = (existing?.assists ?? 0) + (eventKey === "ast" ? 1 : 0);
  const reb_def = (existing?.reb_def ?? 0) + (eventKey === "reb" ? 1 : 0);
  const steals = (existing?.steals ?? 0) + (eventKey === "stl" ? 1 : 0);
  const blocks = (existing?.blocks ?? 0) + (eventKey === "blk" ? 1 : 0);
  const turnovers = (existing?.turnovers ?? 0) + (eventKey === "tov" ? 1 : 0);

  const newPoints = 2 * fgm + tpm + ftm;

  const { error } = await supabase.from("player_game_stats").upsert(
    {
      game_id: gameId,
      match_id: matchId,
      profile_id: profileId,
      minutes: existing?.minutes ?? 0,
      fgm, fga, tpm, tpa, ftm, fta,
      assists, reb_def, steals, blocks, turnovers,
      fouls: existing?.fouls ?? 0,
      points: newPoints,
      is_mvp: existing?.is_mvp ?? false,
      source: "manual",
    },
    { onConflict: "game_id,profile_id,match_id" }
  );
  if (error) return { error: "บันทึกไม่สำเร็จ" };

  return { saved: true };
}

export async function deleteMatch(matchId: string, gameId: string) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;
  await supabase.from("matches").delete().eq("id", matchId);
  revalidatePath(`/games/${gameId}/stats`);
}
