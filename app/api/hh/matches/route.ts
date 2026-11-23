import { NextResponse, type NextRequest } from "next/server";
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
