import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import {
  LiveMatch,
  type LiveTeam,
  type LivePlayer,
} from "@/features/stats/components/live-match";
import { Card } from "@/components/ui/card";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, user, isAdmin } = await getAdminContext();

  const [
    { data: game },
    { data: teamsData },
    { data: existingMatches },
    { data: statKeepers },
    { data: sessionRegs },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, group_id, game_duration_minutes, target_score")
      .eq("id", gameId)
      .single(),
    supabase
      .from("teams")
      .select(
        "id, name, color, team_members(profile_id, profiles(nickname, avatar_url))"
      )
      .eq("game_id", gameId)
      .order("name"),
    supabase
      .from("matches")
      .select("id, status")
      .eq("game_id", gameId)
      .order("created_at", { ascending: true }),
    supabase
      .from("game_stat_keepers")
      .select("profile_id")
      .eq("game_id", gameId),
    supabase
      .from("registrations")
      .select("profile_id, profiles!profile_id(nickname, avatar_url)")
      .eq("game_id", gameId)
      .eq("status", "confirmed"),
  ]);
  if (!game) notFound();

  // Determine user role
  let userRole: "admin" | "statKeeper" | "viewer" = "viewer";
  if (isAdmin) {
    userRole = "admin";
  }
  const keeperIds = new Set((statKeepers ?? []).map((k) => k.profile_id));
  if (keeperIds.has(user.id)) {
    userRole = "statKeeper";
  }
  // Group admins override stat keepers
  if (game.group_id) {
    const { data: gm } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", game.group_id)
      .eq("profile_id", user.id)
      .maybeSingle();
    if (gm?.role === "admin") {
      userRole = "admin";
    }
  }

  const teams: LiveTeam[] = (teamsData ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    members: (
      (t.team_members ?? []) as unknown as {
        profile_id: string;
        profiles: { nickname: string; avatar_url: string | null } | null;
      }[]
    ).map((m) => ({
      profileId: m.profile_id,
      nickname: m.profiles?.nickname ?? "ผู้เล่น",
      avatarUrl: m.profiles?.avatar_url ?? null,
    })),
  }));

  const teamMemberIds = new Set(
    teams.flatMap((t) => t.members.map((m) => m.profileId))
  );
  const sessionPlayers: LivePlayer[] = ((sessionRegs ?? []) as unknown as {
    profile_id: string;
    profiles: { nickname: string; avatar_url: string | null } | null;
  }[])
    .filter((r) => !teamMemberIds.has(r.profile_id))
    .map((r) => ({
      profileId: r.profile_id,
      nickname: r.profiles?.nickname ?? "ผู้เล่น",
      avatarUrl: r.profiles?.avatar_url ?? null,
    }));

  const duration = (game.game_duration_minutes as number) ?? 8;

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">จดสกอร์สด 🔴</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      {teams.length >= 2 ? (
        <LiveMatch
          gameId={gameId}
          teams={teams}
          gameDurationMinutes={duration}
          targetScore={(game.target_score as number) ?? null}
          existingMatches={(existingMatches ?? []) as { id: string; status: string }[]}
          userId={user.id}
          userRole={userRole}
          sessionPlayers={sessionPlayers}
        />
      ) : (
        <Card className="py-12 text-center text-sm text-ink-faint space-y-3">
          <p>ต้องมีอย่างน้อย 2 ทีมก่อนถึงจะจดสกอร์สดได้</p>
          <Link
            href={`/games/${gameId}/teams`}
            className="inline-flex h-10 items-center rounded-xl bg-court px-4 text-sm font-semibold text-white"
          >
            ⚖️ ไปจัดทีมก่อน
          </Link>
        </Card>
      )}
    </main>
  );
}
