import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkHhToken } from "@/lib/hh/auth";

export const runtime = "nodejs";

/** GET /api/hh/roster?gameId=… — players confirmed (ตัวจริง) for one Session. */
export async function GET(req: NextRequest) {
  const auth = checkHhToken(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const gameId = req.nextUrl.searchParams.get("gameId");
  if (!gameId) return NextResponse.json({ error: "gameId required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("registrations")
    .select("profile_id, status, profiles!profile_id(nickname, avatar_url, height_cm)")
    .eq("game_id", gameId)
    .eq("status", "confirmed")
    .order("registered_at");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    players: (data ?? []).map((r) => {
      const p = r.profiles as unknown as { nickname: string; avatar_url: string | null; height_cm: number | null } | null;
      return { profileId: r.profile_id, nickname: p?.nickname ?? "", avatarUrl: p?.avatar_url ?? null, heightCm: p?.height_cm ?? null };
    }),
  });
}
