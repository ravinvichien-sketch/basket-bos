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
 * โหมดจดสกอร์สด: บันทึกผลแมตช์ + สถิติรายคนของแมตช์นี้
 * สถิติของแต่ละแมตช์เก็บแยก row (match_id) — ไม่รวมกับแมตช์อื่น
 * ส่วนสถิติรวมทุกแมตช์ดูได้จาก v_player_season_stats (aggregate profile_id)
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

  // Create match and get its id
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

export async function deleteMatch(matchId: string, gameId: string) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;
  await supabase.from("matches").delete().eq("id", matchId);
  revalidatePath(`/games/${gameId}/stats`);
}
