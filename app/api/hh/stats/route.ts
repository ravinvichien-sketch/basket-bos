import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkHhToken } from "@/lib/hh/auth";

export const runtime = "nodejs";

import { revalidatePath } from "next/cache";

/** Let the Basket Bos pages show what Hoop Highlights just wrote, without a hard refresh. */
function refreshGame(gameId: string) {
  for (const p of ["", "/stats", "/summary", "/teams", "/live", "/videos"]) {
    try { revalidatePath(`/games/${gameId}${p}`); } catch { /* nothing to revalidate */ }
  }
}

const int = z.number().int().min(0).max(200);

const playerSchema = z
  .object({
    profileId: z.string().uuid(),
    teamId: z.string().uuid().optional(),
    // fgm includes 3-pointers (same convention as recordMatchEvent: points = 2*fgm + tpm + ftm)
    fgm: int, fga: int, tpm: int, tpa: int, ftm: int, fta: int,
    assists: int, rebOff: int, rebDef: int, steals: int, blocks: int, turnovers: int,
    // optional: when omitted, the existing value in the database is kept
    fouls: int.optional(),
    minutes: int.optional(),
    plusMinus: z.number().int().min(-200).max(200).optional(),
    isMvp: z.boolean().optional(),
  })
  .refine((p) => p.fgm <= p.fga && p.tpm <= p.tpa && p.ftm <= p.fta && p.tpm <= p.fgm, {
    message: "made must not exceed attempts (3PM ≤ FGM ≤ FGA, FTM ≤ FTA)",
  });

const bodySchema = z.object({
  gameId: z.string().uuid(),
  matchId: z.string().uuid(),
  players: z.array(playerSchema).min(1).max(40),
});

/**
 * POST /api/hh/stats — write the FINAL totals of each listed player for one match.
 * Totals are set (not added), so sending the same body twice gives the same result.
 * Players not in `players` are left untouched.
 */
export async function POST(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  }
  const { gameId, matchId, players } = parsed.data;
  const db = createAdminClient();

  const { data: match } = await db.from("matches").select("id").eq("id", matchId).eq("game_id", gameId).maybeSingle();
  if (!match) return NextResponse.json({ error: "match does not belong to this game" }, { status: 404 });

  const ids = players.map((p) => p.profileId);
  const { data: existing, error: readErr } = await db
    .from("player_game_stats")
    .select("profile_id, team_id, fouls, minutes, plus_minus, is_mvp")
    .eq("game_id", gameId)
    .eq("match_id", matchId)
    .in("profile_id", ids);
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });
  const prev = new Map((existing ?? []).map((r) => [r.profile_id as string, r]));

  const rows = players.map((p) => {
    const old = prev.get(p.profileId);
    return {
      game_id: gameId,
      match_id: matchId,
      profile_id: p.profileId,
      team_id: p.teamId ?? old?.team_id ?? null,
      fgm: p.fgm, fga: p.fga, tpm: p.tpm, tpa: p.tpa, ftm: p.ftm, fta: p.fta,
      points: 2 * p.fgm + p.tpm + p.ftm,
      assists: p.assists, reb_off: p.rebOff, reb_def: p.rebDef,
      steals: p.steals, blocks: p.blocks, turnovers: p.turnovers,
      fouls: p.fouls ?? old?.fouls ?? 0,
      minutes: p.minutes ?? old?.minutes ?? 0,
      plus_minus: p.plusMinus ?? old?.plus_minus ?? 0,
      is_mvp: p.isMvp ?? old?.is_mvp ?? false,
      source: "hybrid",
    };
  });

  const { error } = await db.from("player_game_stats").upsert(rows, { onConflict: "game_id,match_id,profile_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  refreshGame(gameId);
  return NextResponse.json({ saved: rows.length });
}

/** GET /api/hh/stats?gameId=…&matchId=… — current Basket Bos totals of one match (for the compare screen). */
export async function GET(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const gameId = req.nextUrl.searchParams.get("gameId");
  const matchId = req.nextUrl.searchParams.get("matchId");
  if (!gameId || !matchId) return NextResponse.json({ error: "gameId and matchId required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("player_game_stats")
    .select("profile_id, team_id, points, fgm, fga, tpm, tpa, ftm, fta, assists, reb_off, reb_def, steals, blocks, turnovers, fouls, minutes, plus_minus, is_mvp, source")
    .eq("game_id", gameId)
    .eq("match_id", matchId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stats: data ?? [] });
}
