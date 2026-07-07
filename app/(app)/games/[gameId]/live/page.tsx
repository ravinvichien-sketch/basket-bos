import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import {
  LiveMatch,
  type LiveTeam,
} from "@/features/stats/components/live-match";
import { Card } from "@/components/ui/card";

export default async function LiveMatchPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase } = await getAdminContext();

  const [{ data: game }, { data: teamsData }] = await Promise.all([
    supabase.from("games").select("id, title").eq("id", gameId).single(),
    supabase
      .from("teams")
      .select(
        "id, name, color, team_members(profile_id, profiles(nickname, avatar_url))"
      )
      .eq("game_id", gameId)
      .order("name"),
  ]);
  if (!game) notFound();

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

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}/stats`} className="text-xs text-ink-faint">
          ← กลับหน้าสถิติ
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">จดสกอร์สด 🔴</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      {teams.length >= 2 ? (
        <LiveMatch gameId={gameId} teams={teams} />
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
