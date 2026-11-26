import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkHhToken } from "@/lib/hh/auth";

export const runtime = "nodejs";

/** GET /api/hh/matches?gameId=… — matches (team pairs) of one Session. */
export async function GET(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  const db = createAdminClient();
  const { data: matches, error } = await db
    .from("matches")
    .select("id, team_a, team_b, score_a, score_b, created_at")
    .eq("game_id", gameId)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const teamIds = [...new Set((matches ?? []).flatMap((m) => [m.team_a, m.team_b]))];
  const { data: teams } = teamIds.length
    ? await db.from("teams").select("id, name").in("id", teamIds)
    : { data: [] as { id: string; name: string }[] };
  const name = new Map((teams ?? []).map((t) => [t.id, t.name]));

  return NextResponse.json({
    matches: (matches ?? []).map((m, i) => ({
      id: m.id,
      index: i + 1,
      teamA: { id: m.team_a, name: name.get(m.team_a) ?? "" },
      teamB: { id: m.team_b, name: name.get(m.team_b) ?? "" },
      scoreA: m.score_a,
      scoreB: m.score_b,
    })),
  });
}

const createSchema = z.object({
  gameId: z.string().uuid(),
  teamA: z.string().uuid(),
  teamB: z.string().uuid(),
  scoreA: z.number().int().min(0).max(500).default(0),
  scoreB: z.number().int().min(0).max(500).default(0),
  isWarmup: z.boolean().optional(),
});

/** POST /api/hh/matches — create one match (team pair + final score) recorded in Hoop Highlights. */
export async function POST(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  const { gameId, teamA, teamB, scoreA, scoreB, isWarmup } = parsed.data;
  if (teamA === teamB) return NextResponse.json({ error: "teamA and teamB must differ" }, { status: 400 });

  const db = createAdminClient();
  const { data: teams, error: teamErr } = await db
    .from("teams")
    .select("id, name")
    .eq("game_id", gameId)
    .in("id", [teamA, teamB]);
  if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
  if ((teams ?? []).length !== 2) {
    return NextResponse.json({ error: "both teams must belong to this game" }, { status: 404 });
  }
  const nameOf = (id: string) => (teams ?? []).find((t) => t.id === id)?.name ?? null;

  const { count } = await db.from("matches").select("*", { count: "exact", head: true }).eq("game_id", gameId);

  const { data: made, error } = await db
    .from("matches")
    .insert({
      game_id: gameId,
      team_a: teamA,
      team_b: teamB,
      team_a_name: nameOf(teamA),
      team_b_name: nameOf(teamB),
      score_a: scoreA,
      score_b: scoreB,
      is_warmup: isWarmup ?? false,
      status: "finished",
    })
    .select("id")
    .single();
  if (error || !made) return NextResponse.json({ error: error?.message ?? "could not create match" }, { status: 500 });

  return NextResponse.json({ matchId: made.id, index: (count ?? 0) + 1 });
}
