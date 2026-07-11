"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser, getGameEditorContext, getAdminContext } from "@/features/auth/guards";
import { computeGameScore, findMVP } from "./lib/mvp";

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

  // ลบ row เก่าที่ไม่มี match_id แล้ว insert ใหม่
  // (unique constraint คือ game_id,match_id,profile_id → onConflict ต้องครบทั้ง 3 ตัว)
  await supabase.from("player_game_stats").delete().eq("game_id", gameId).is("match_id", null);

  const { error } = await supabase.from("player_game_stats").insert(rows);
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
): Promise<ActionState & { matchId?: string; matchName?: string }> {
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

  // Count existing matches for auto-naming
  const { count } = await supabase
    .from("matches")
    .select("*", { count: "exact", head: true })
    .eq("game_id", gameId);

  const matchName = `เกมส์ที่ ${(count ?? 0) + 1}`;

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

  // เปลี่ยนสถานะ Session เป็น in_progress เพื่อให้ recordMatchEvent ทำงานได้
  await supabase.from("games").update({ status: "in_progress" }).eq("id", gameId);

  revalidatePath(`/games/${gameId}`);
  return { matchId: match.id, matchName };
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

  // Build team map from current team_members
  let teamMap = new Map<string, string>();
  if (d.team_a && d.team_b) {
    const { data: teamMembers } = await supabase
      .from("team_members")
      .select("profile_id, team_id")
      .in("team_id", [d.team_a, d.team_b]);
    teamMap = new Map((teamMembers ?? []).map((tm) => [tm.profile_id, tm.team_id]));
  }

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

  // ── ถ้ามี d.lines ให้แทนที่ stats ทั้งหมดของ match นี้ ──
  if (d.lines.length > 0) {
    await supabase.from("player_game_stats").delete().eq("match_id", matchId);

    const rows = d.lines.map((l) => {
      const fgm = l.fgm;
      const tpm = l.tpm;
      const ftm = l.ftm;
      return {
        game_id: gameId,
        match_id: matchId,
        profile_id: l.profile_id,
        team_id: teamMap.get(l.profile_id) ?? null,
        minutes: 0,
        fgm, fga: l.fga,
        tpm, tpa: l.tpa,
        ftm, fta: l.fta,
        assists: l.assists,
        reb_off: l.reb_off, reb_def: l.reb_def,
        steals: l.steals, blocks: l.blocks,
        turnovers: l.turnovers, fouls: l.fouls,
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

  // ── อ่าน stats ล่าสุดของ match (ใช้คำนวณ MVP + +/-) ──
  const { data: finalStats } = await supabase
    .from("player_game_stats")
    .select("profile_id, points, fgm, fga, tpm, tpa, ftm, fta, assists, reb_off, reb_def, steals, blocks, turnovers, fouls")
    .eq("match_id", matchId);

  if (finalStats && finalStats.length > 0) {
    // Set team_id
    if (teamMap.size > 0) {
      for (const s of finalStats) {
        const tid = teamMap.get(s.profile_id);
        if (tid) {
          await supabase
            .from("player_game_stats")
            .update({ team_id: tid })
            .eq("match_id", matchId)
            .eq("profile_id", s.profile_id);
        }
      }
    }

    // หา MVP
    const gameScores = finalStats.map((s) => ({
      profile_id: s.profile_id,
      gameScore: computeGameScore({
        points: s.points, fgm: s.fgm, fga: s.fga,
        tpm: s.tpm, tpa: s.tpa,
        ftm: s.ftm, fta: s.fta,
        oreb: s.reb_off, dreb: s.reb_def,
        ast: s.assists, stl: s.steals, blk: s.blocks,
        tov: s.turnovers, pf: s.fouls,
      }),
    }));

    const mvpId = findMVP(gameScores);
    if (mvpId) {
      await supabase
        .from("player_game_stats")
        .update({ is_mvp: false })
        .eq("match_id", matchId);
      await supabase
        .from("player_game_stats")
        .update({ is_mvp: true })
        .eq("match_id", matchId)
        .eq("profile_id", mvpId);
    }

    // คำนวณ +/- แจกตามสัดส่วน points
    if (d.team_a && d.team_b && teamMap.size > 0) {
      for (const s of finalStats) {
        const teamId = teamMap.get(s.profile_id);
        if (!teamId) continue;

        const margin = d.score_a - d.score_b;
        const isTeamA = teamId === d.team_a;
        const effectiveMargin = isTeamA ? margin : -margin;

        const teamStats = finalStats.filter((st) => teamMap.get(st.profile_id) === teamId);
        const totalTeamPoints = teamStats.reduce((sum, st) => sum + st.points, 0);
        if (totalTeamPoints > 0) {
          const plusMinus = Math.round(effectiveMargin * (s.points / totalTeamPoints));
          await supabase
            .from("player_game_stats")
            .update({ plus_minus: plusMinus })
            .eq("match_id", matchId)
            .eq("profile_id", s.profile_id);
        }
      }
    }
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

/** แอดมินของ Session: อนุมัติ/ปฏิเสธ สถิติที่นักกีฬาส่งมา */
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
        ? "เฉพาะแอดมินของ Session นี้เท่านั้น"
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

  const { data: matchRec } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();
  if (matchRec?.status === "finished") return { error: "เกมส์นี้จบไปแล้ว" };

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
    case "miss3": delta.fga = 1; delta.tpa = 1; break;
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
  const reb_off = (existing?.reb_off ?? 0) + (eventKey === "reb_off" ? 1 : 0);
  const reb_def = (existing?.reb_def ?? 0) + (eventKey === "reb_def" ? 1 : 0);
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
      assists, reb_off, reb_def, steals, blocks, turnovers,
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

/** บันทึกนาทีที่สะสมไว้ให้ผู้เล่นในแมทช์ (เรียกเมื่อจบเกมส์) */
export async function saveMatchMinutes(
  matchId: string,
  gameId: string,
  minutes: Record<string, number>
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const entries = Object.entries(minutes);
  if (entries.length === 0) return {};

  for (const [profileId, sec] of entries) {
    const mins = Math.round(sec / 60);
    const { data: existing } = await supabase
      .from("player_game_stats")
      .select("id, minutes")
      .eq("game_id", gameId)
      .eq("match_id", matchId)
      .eq("profile_id", profileId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("player_game_stats")
        .update({ minutes: mins })
        .eq("id", existing.id);
    }
  }
  return { saved: true };
}

/** ยกเลิก event ล่าสุด — ลดค่าสถิติตาม eventKey */
export async function undoMatchEvent(
  matchId: string,
  gameId: string,
  profileId: string,
  eventKey: string
): Promise<ActionState> {
  const { supabase } = await requireUser();

  const { data: game } = await supabase
    .from("games")
    .select("status")
    .eq("id", gameId)
    .single();
  if (!game || game.status === "completed") return { error: "Session นี้จบแล้ว" };
  if (game.status !== "in_progress") return { error: "Session นี้ยังไม่เริ่มแข่ง" };

  const { data: undoMatchRec } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();
  if (undoMatchRec?.status === "finished") return { error: "เกมส์นี้จบไปแล้ว" };

  const { data: existing } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("game_id", gameId)
    .eq("match_id", matchId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!existing) return { error: "ไม่พบสถิติ" };

  // Decrement based on event key
  const pointsDec =
    eventKey === "make2" ? 2 : eventKey === "make3" ? 3 : eventKey === "makeFt" ? 1 : 0;
  const isShot = ["make2", "make3", "makeFt"].includes(eventKey);
  const isMiss = ["miss", "miss3"].includes(eventKey);

  const decrement = (v: number, d: number) => Math.max(0, v - d);

  const { error } = await supabase
    .from("player_game_stats")
    .update({
      points: decrement(existing.points ?? 0, pointsDec),
      fgm: isShot ? decrement(existing.fgm ?? 0, 1) : existing.fgm,
      fga: isShot || isMiss ? decrement(existing.fga ?? 0, 1) : existing.fga,
      tpm: eventKey === "make3" ? decrement(existing.tpm ?? 0, 1) : existing.tpm,
      tpa: eventKey === "make3" || eventKey === "miss3" ? decrement(existing.tpa ?? 0, 1) : existing.tpa,
      ftm: eventKey === "makeFt" ? decrement(existing.ftm ?? 0, 1) : existing.ftm,
      fta: eventKey === "makeFt" ? decrement(existing.fta ?? 0, 1) : existing.fta,
      reb_off: eventKey === "reb_off" ? decrement(existing.reb_off ?? 0, 1) : existing.reb_off,
      reb_def: eventKey === "reb_def" ? decrement(existing.reb_def ?? 0, 1) : existing.reb_def,
      assists: eventKey === "ast" ? decrement(existing.assists ?? 0, 1) : existing.assists,
      steals: eventKey === "stl" ? decrement(existing.steals ?? 0, 1) : existing.steals,
      blocks: eventKey === "blk" ? decrement(existing.blocks ?? 0, 1) : existing.blocks,
      turnovers: eventKey === "tov" ? decrement(existing.turnovers ?? 0, 1) : existing.turnovers,
    })
    .eq("id", existing.id);

  if (error) return { error: "เลิกทำไม่สำเร็จ" };
  return {};
}

/** ลดคะแนนผู้เล่นใน match โดยตรง (แก้ไขกรณีกด score ผิด) */
export async function subtractPoints(
  matchId: string,
  gameId: string,
  profileId: string,
  amount: number
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return { error: "ไม่พบผู้ใช้" };

  const { data: game } = await supabase
    .from("games")
    .select("group_id, acting_admin_id, status")
    .eq("id", gameId)
    .single();
  if (!game || game.status !== "in_progress") return { error: "Session นี้ยังไม่เริ่มแข่งหรือจบแล้ว" };

  const { data: subMatchRec } = await supabase
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();
  if (subMatchRec?.status === "finished") return { error: "เกมส์นี้จบไปแล้ว" };

  const isAdmin = (await supabase.from("profiles").select("role").eq("id", userId).single()).data?.role === "admin";
  const isGroupAdmin = (await supabase.from("group_members").select("role").eq("group_id", game.group_id).eq("profile_id", userId).single()).data?.role === "admin";
  const isActingAdmin = game.acting_admin_id === userId;
  const { count } = await supabase
    .from("game_stat_keepers")
    .select("profile_id", { count: "exact", head: true })
    .eq("game_id", gameId)
    .eq("profile_id", userId);
  const isStatKeeper = (count ?? 0) > 0;
  if (!isAdmin && !isGroupAdmin && !isActingAdmin && !isStatKeeper) return { error: "คุณไม่มีสิทธิ์" };

  const { data: existing } = await supabase
    .from("player_game_stats")
    .select("*")
    .eq("game_id", gameId)
    .eq("match_id", matchId)
    .eq("profile_id", profileId)
    .maybeSingle();
  if (!existing) return { error: "ไม่พบสถิติ" };

  const newPoints = Math.max(0, (existing.points ?? 0) - amount);
  const { error } = await supabase
    .from("player_game_stats")
    .update({ points: newPoints })
    .eq("id", existing.id);

  if (error) return { error: "ลดคะแนนไม่สำเร็จ" };
  return {};
}

export async function deleteMatch(matchId: string, gameId: string) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;
  await supabase.from("matches").delete().eq("id", matchId);
  revalidatePath(`/games/${gameId}/stats`);
}

// ── Super Admin: แก้ไข Match ที่จบไปแล้ว ──

const adminUpdateMatchSchema = z.object({
  match_id: z.string(),
  team_a: z.string(),
  team_b: z.string(),
  score_a: z.coerce.number().int().min(0).max(500),
  score_b: z.coerce.number().int().min(0).max(500),
});

export async function adminUpdateMatch(formData: FormData) {
  const { supabase, isAdmin: isSuperAdmin } = await getAdminContext();
  if (!isSuperAdmin) return;

  const parsed = adminUpdateMatchSchema.safeParse({
    match_id: formData.get("match_id"),
    team_a: formData.get("team_a"),
    team_b: formData.get("team_b"),
    score_a: formData.get("score_a"),
    score_b: formData.get("score_b"),
  });
  if (!parsed.success) return;

  const { data: teamRows } = await supabase
    .from("teams")
    .select("id, name")
    .in("id", [parsed.data.team_a, parsed.data.team_b]);
  const nameOf = (id: string) =>
    teamRows?.find((t) => t.id === id)?.name ?? null;

  const { error } = await supabase
    .from("matches")
    .update({
      team_a: parsed.data.team_a,
      team_b: parsed.data.team_b,
      team_a_name: nameOf(parsed.data.team_a),
      team_b_name: nameOf(parsed.data.team_b),
      score_a: parsed.data.score_a,
      score_b: parsed.data.score_b,
    })
    .eq("id", parsed.data.match_id);
  if (error) return;

  revalidatePath(`/games/${gameIdFromMatch(parsed.data.match_id)}/stats`);
}

export async function adminDeleteMatch(matchId: string, gameId: string) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return;
  await supabase.from("matches").delete().eq("id", matchId);
  await supabase.from("player_game_stats").delete().eq("match_id", matchId);
  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath(`/games/${gameId}/summary`);
  revalidatePath(`/games/${gameId}`);
}

// ── Super Admin: ลบเกมส์ทั้ง Session ──

export async function adminDeleteGame(gameId: string) {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะ Super Admin" };
  await supabase.rpc("delete_game_session", { p_game_id: gameId });
  revalidatePath("/games");
  revalidatePath("/groups");
  return {};
}

// ── Super Admin: แก้ไข stats ผู้เล่นใน match ใดๆ ──

const adminUpdateStatSchema = z.object({
  match_id: z.string(),
  profile_id: z.string(),
  minutes: z.coerce.number().int().min(0).max(300),
  points: z.coerce.number().int().min(0).max(200),
  fgm: z.coerce.number().int().min(0).max(200),
  fga: z.coerce.number().int().min(0).max(200),
  tpm: z.coerce.number().int().min(0).max(200),
  tpa: z.coerce.number().int().min(0).max(200),
  ftm: z.coerce.number().int().min(0).max(200),
  fta: z.coerce.number().int().min(0).max(200),
  assists: z.coerce.number().int().min(0).max(200),
  reb_off: z.coerce.number().int().min(0).max(200),
  reb_def: z.coerce.number().int().min(0).max(200),
  steals: z.coerce.number().int().min(0).max(200),
  blocks: z.coerce.number().int().min(0).max(200),
  turnovers: z.coerce.number().int().min(0).max(200),
  fouls: z.coerce.number().int().min(0).max(200),
  is_mvp: z.coerce.boolean(),
});

export async function adminUpdatePlayerStat(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) return { error: "เฉพาะ Super Admin" };

  const parsed = adminUpdateStatSchema.safeParse({
    match_id: formData.get("match_id"),
    profile_id: formData.get("profile_id"),
    minutes: formData.get("minutes"),
    points: formData.get("points"),
    fgm: formData.get("fgm"), fga: formData.get("fga"),
    tpm: formData.get("tpm"), tpa: formData.get("tpa"),
    ftm: formData.get("ftm"), fta: formData.get("fta"),
    assists: formData.get("assists"),
    reb_off: formData.get("reb_off"),
    reb_def: formData.get("reb_def"),
    steals: formData.get("steals"),
    blocks: formData.get("blocks"),
    turnovers: formData.get("turnovers"),
    fouls: formData.get("fouls"),
    is_mvp: formData.get("is_mvp") === "1",
  });
  if (!parsed.success) return { error: "ข้อมูลไม่ถูกต้อง" };

  const { error } = await supabase
    .from("player_game_stats")
    .update({
      minutes: parsed.data.minutes,
      points: parsed.data.points,
      fgm: parsed.data.fgm, fga: parsed.data.fga,
      tpm: parsed.data.tpm, tpa: parsed.data.tpa,
      ftm: parsed.data.ftm, fta: parsed.data.fta,
      assists: parsed.data.assists,
      reb_off: parsed.data.reb_off,
      reb_def: parsed.data.reb_def,
      steals: parsed.data.steals,
      blocks: parsed.data.blocks,
      turnovers: parsed.data.turnovers,
      fouls: parsed.data.fouls,
      is_mvp: parsed.data.is_mvp,
    })
    .eq("match_id", parsed.data.match_id)
    .eq("profile_id", parsed.data.profile_id);
  if (error) return { error: "บันทึกไม่สำเร็จ" };

  revalidatePath(`/games/${formData.get("game_id")}/stats`);
  return { saved: true };
}

// ── ผู้เล่น: แก้ไขสถิติตัวเองในแมตช์ที่จบแล้ว (ยกเว้นแต้ม) ──

const selfStatSchema = z.object({
  match_id: z.string().uuid(),
  minutes: z.coerce.number().int().min(0).max(300),
  fgm: z.coerce.number().int().min(0).max(200),
  fga: z.coerce.number().int().min(0).max(200),
  tpm: z.coerce.number().int().min(0).max(200),
  tpa: z.coerce.number().int().min(0).max(200),
  ftm: z.coerce.number().int().min(0).max(200),
  fta: z.coerce.number().int().min(0).max(200),
  assists: z.coerce.number().int().min(0).max(200),
  reb_off: z.coerce.number().int().min(0).max(200),
  reb_def: z.coerce.number().int().min(0).max(200),
  steals: z.coerce.number().int().min(0).max(200),
  blocks: z.coerce.number().int().min(0).max(200),
  turnovers: z.coerce.number().int().min(0).max(200),
  fouls: z.coerce.number().int().min(0).max(200),
});

export async function updateOwnMatchStats(gameId: string, formData: FormData) {
  const { supabase, user, isAdmin } = await getAdminContext();
  const parsed = selfStatSchema.safeParse({
    match_id: formData.get("match_id"),
    minutes: formData.get("minutes"),
    fgm: formData.get("fgm"), fga: formData.get("fga"),
    tpm: formData.get("tpm"), tpa: formData.get("tpa"),
    ftm: formData.get("ftm"), fta: formData.get("fta"),
    assists: formData.get("assists"),
    reb_off: formData.get("reb_off"),
    reb_def: formData.get("reb_def"),
    steals: formData.get("steals"),
    blocks: formData.get("blocks"),
    turnovers: formData.get("turnovers"),
    fouls: formData.get("fouls"),
  });
  if (!parsed.success) return;

  const profileId = user.id;

  const { data: existing } = await supabase
    .from("player_game_stats")
    .select("points")
    .eq("match_id", parsed.data.match_id)
    .eq("profile_id", profileId)
    .single();
  if (!existing) return;

  const points = isAdmin
    ? Number(formData.get("points") ?? existing.points)
    : existing.points;

  const { fgm, fga, tpm, tpa } = parsed.data;
  if (fgm < tpm || fga < fgm || tpa < tpm) return;

  const { error } = await supabase
    .from("player_game_stats")
    .update({
      minutes: parsed.data.minutes,
      points,
      fgm: parsed.data.fgm, fga: parsed.data.fga,
      tpm: parsed.data.tpm, tpa: parsed.data.tpa,
      ftm: parsed.data.ftm, fta: parsed.data.fta,
      assists: parsed.data.assists,
      reb_off: parsed.data.reb_off,
      reb_def: parsed.data.reb_def,
      steals: parsed.data.steals,
      blocks: parsed.data.blocks,
      turnovers: parsed.data.turnovers,
      fouls: parsed.data.fouls,
    })
    .eq("match_id", parsed.data.match_id)
    .eq("profile_id", profileId);
  if (error) return;

  revalidatePath(`/games/${gameId}/stats`);
  revalidatePath(`/games/${gameId}/summary`);
}

// helper
async function gameIdFromMatch(matchId: string): Promise<string> {
  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("matches")
    .select("game_id")
    .eq("id", matchId)
    .single();
  return data?.game_id ?? "";
}

/** บันทึก URL การ์ดที่ generate แล้ว */
export async function saveCardUrl(
  gameId: string,
  profileId: string,
  cardUrl: string
): Promise<ActionState & { id?: string }> {
  const { supabase } = await requireUser();
  const { data: existing } = await supabase
    .from("player_card_generations")
    .select("id")
    .eq("game_id", gameId)
    .eq("profile_id", profileId)
    .maybeSingle();

  let id: string;
  if (existing) {
    const { error } = await supabase
      .from("player_card_generations")
      .update({ card_url: cardUrl })
      .eq("id", existing.id);
    if (error) return { error: "บันทึกไม่สำเร็จ" };
    id = existing.id;
  } else {
    const { data, error } = await supabase
      .from("player_card_generations")
      .insert({ game_id: gameId, profile_id: profileId, card_url: cardUrl })
      .select("id")
      .single();
    if (error) return { error: "บันทึกไม่สำเร็จ" };
    id = data.id;
  }

  revalidatePath(`/games/${gameId}/my-stats`);
  return { saved: true, id };
}

/** บันทึก URL รูป AI */
export async function saveAiImageUrl(
  gameId: string,
  profileId: string,
  aiImageUrl: string
): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { data: existing } = await supabase
    .from("player_card_generations")
    .select("id")
    .eq("game_id", gameId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("player_card_generations")
      .update({ ai_image_url: aiImageUrl })
      .eq("id", existing.id);
    if (error) return { error: "บันทึกไม่สำเร็จ" };
  } else {
    const { error } = await supabase
      .from("player_card_generations")
      .insert({ game_id: gameId, profile_id: profileId, ai_image_url: aiImageUrl });
    if (error) return { error: "บันทึกไม่สำเร็จ" };
  }

  revalidatePath(`/games/${gameId}/my-stats`);
  return { saved: true };
}
