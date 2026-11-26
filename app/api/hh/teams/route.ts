import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkHhToken } from "@/lib/hh/auth";

export const runtime = "nodejs";

/** GET /api/hh/teams?gameId=… — teams of one Session with their members. */
export async function GET(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  const db = createAdminClient();
  const { data: teams, error } = await db
    .from("teams")
    .select("id, name, color")
    .eq("game_id", gameId)
    .order("name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const ids = (teams ?? []).map((t) => t.id);
  const { data: members } = ids.length
    ? await db.from("team_members").select("team_id, profile_id").in("team_id", ids)
    : { data: [] as { team_id: string; profile_id: string }[] };

  return NextResponse.json({
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      members: (members ?? []).filter((m) => m.team_id === t.id).map((m) => m.profile_id),
    })),
  });
}

// Falls back to the colours Hoop Highlights uses for the left and right side.
const HH_COLORS = ["#F5A623", "#4FC3F7", "#334155", "#E2E8F0"];

const bodySchema = z.object({
  gameId: z.string().uuid(),
  teams: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(40),
        color: z.string().trim().max(20).optional(),
        members: z.array(z.string().uuid()).max(40).default([]),
      })
    )
    .min(1)
    .max(8),
});

/**
 * POST /api/hh/teams — replace this Session's teams with the ones Hoop Highlights sends.
 *
 * New rows are written first and only then are the old ones removed, and a team a match
 * already points at is always kept, so saved matches and their stats are never orphaned.
 */
export async function POST(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    );
  }
  const { gameId, teams } = parsed.data;
  const db = createAdminClient();

  const { data: game } = await db.from("games").select("id").eq("id", gameId).maybeSingle();
  if (!game) return NextResponse.json({ error: "game not found" }, { status: 404 });

  const { data: before, error: beforeErr } = await db.from("teams").select("id").eq("game_id", gameId);
  if (beforeErr) return NextResponse.json({ error: beforeErr.message }, { status: 500 });
  const oldIds = (before ?? []).map((t) => t.id);

  const { data: made, error: insErr } = await db
    .from("teams")
    .insert(teams.map((t, i) => ({ game_id: gameId, name: t.name, color: t.color ?? HH_COLORS[i % HH_COLORS.length] })))
    .select("id, name");
  if (insErr || !made) return NextResponse.json({ error: insErr?.message ?? "could not create teams" }, { status: 500 });

  const memberRows = made.flatMap((row, i) =>
    teams[i].members.map((profileId) => ({ team_id: row.id, profile_id: profileId }))
  );
  if (memberRows.length) {
    const { error: memErr } = await db.from("team_members").insert(memberRows);
    if (memErr) {
      await db.from("teams").delete().in("id", made.map((r) => r.id));
      return NextResponse.json({ error: memErr.message }, { status: 500 });
    }
  }

  let kept = 0;
  if (oldIds.length) {
    const { data: used } = await db.from("matches").select("team_a, team_b").eq("game_id", gameId);
    const referenced = new Set((used ?? []).flatMap((m) => [m.team_a, m.team_b]).filter(Boolean) as string[]);
    const removable = oldIds.filter((id) => !referenced.has(id));
    kept = oldIds.length - removable.length;
    if (removable.length) await db.from("teams").delete().in("id", removable);
  }

  return NextResponse.json({
    teams: made.map((r) => ({ id: r.id, name: r.name })),
    replaced: oldIds.length - kept,
    keptForSavedMatches: kept,
  });
}
