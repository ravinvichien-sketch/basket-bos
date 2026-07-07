import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { computeOvr, tierOf, type SeasonStats } from "@/features/stats/lib/ratings";
import { CardViewToggle } from "@/features/stats/components/card-view-toggle";
import { ShareCardButton } from "@/features/stats/components/share-card-button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/format";
import {
  ProfileComments,
  type CommentView,
} from "@/features/profile/components/profile-comments";
import {
  DreamTeamSection,
  type DreamTeamView,
} from "@/features/profile/components/dream-teams";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  const { supabase, user } = await getAdminContext();

  const [{ data: profile }, { data: positions }, { data: season }, { data: log }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", playerId).single(),
      supabase
        .from("player_positions")
        .select("position, priority")
        .eq("profile_id", playerId)
        .order("priority"),
      supabase
        .from("v_player_season_stats")
        .select("*")
        .eq("profile_id", playerId)
        .maybeSingle(),
      supabase
        .from("player_game_stats")
        .select("id, points, assists, reb_off, reb_def, steals, blocks, is_mvp, games(id, title, starts_at)")
        .eq("profile_id", playerId)
        .order("created_at", { ascending: false })
        .limit(5),
    ]);
  if (!profile) notFound();

  const isMe = playerId === user.id;

  // Comments
  const { data: rawComments } = await supabase
    .from("profile_comments")
    .select("id, content, created_at, author_id, profiles!author_id(nickname)")
    .eq("target_id", playerId)
    .order("created_at", { ascending: false });

  // Dream teams
  const { data: myTeams } = await supabase
    .from("dream_teams")
    .select("id, name, owner_id, profiles!owner_id(nickname)")
    .or(`owner_id.eq.${playerId}`);

  const teamIds = (myTeams ?? []).map((t: { id: string }) => t.id);
  const { data: teamMembers } = teamIds.length > 0
    ? await supabase
        .from("dream_team_members")
        .select("id, dream_team_id, profile_id, status, profiles!profile_id(nickname)")
        .in("dream_team_id", teamIds)
    : { data: [] };

  const dtTeams: DreamTeamView[] = ((myTeams ?? []) as unknown[]).map((t) => {
    const tt = t as { id: string; name: string; owner_id: string; profiles: { nickname: string } | { nickname: string }[] | null };
    const ownerNick = Array.isArray(tt.profiles)
      ? tt.profiles[0]?.nickname ?? "ผู้เล่น"
      : tt.profiles?.nickname ?? "ผู้เล่น";
    const members: { id: string; profile_id: string; nickname: string; status: string }[] = [];
    for (const m of (teamMembers ?? []) as unknown as { id: string; dream_team_id: string; profile_id: string; status: string; profiles: { nickname: string } | null }[]) {
      if (m.dream_team_id === tt.id) {
        members.push({
          id: m.id,
          profile_id: m.profile_id,
          nickname: m.profiles?.nickname ?? "ผู้เล่น",
          status: m.status,
        });
      }
    }
    return {
      id: tt.id,
      name: tt.name,
      owner_id: tt.owner_id,
      owner_nickname: ownerNick,
      members,
    };
  });

  const { data: candidateProfiles } = isMe
    ? await supabase
        .from("profiles")
        .select("id, nickname")
        .neq("id", user.id)
        .eq("onboarded", true)
        .order("nickname")
    : { data: [] };
  const dtCandidates = (candidateProfiles ?? []).map((p: { id: string; nickname: string }) => ({
    id: p.id,
    nickname: p.nickname,
  }));

  const stats: SeasonStats | null = season
    ? {
        games_played: Number(season.games_played),
        ppg: Number(season.ppg ?? 0),
        rpg: Number(season.rpg ?? 0),
        apg: Number(season.apg ?? 0),
        spg: Number(season.spg ?? 0),
        bpg: Number(season.bpg ?? 0),
        fg_pct: season.fg_pct != null ? Number(season.fg_pct) : null,
        mvp_count: Number(season.mvp_count ?? 0),
      }
    : null;

  const ovr = computeOvr(stats);
  const tier = tierOf(ovr);

  const comments: CommentView[] = ((rawComments ?? []) as unknown[]).map((c) => {
    const r = c as {
      id: string;
      content: string;
      created_at: string;
      author_id: string;
      profiles: { nickname: string } | null;
    };
    return {
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author_id: r.author_id,
      author_nickname: r.profiles?.nickname ?? "ผู้เล่น",
    };
  });

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href="/leaderboard" className="text-xs text-ink-faint">
          ← จัดอันดับ
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">
          {profile.nickname}
          {isMe && <span className="text-sm text-ink-faint"> (คุณ)</span>}
        </h1>
      </header>

      {isMe && (
        <Card>
          <CardTitle>🌟 Dream Team</CardTitle>
          <div className="mt-2">
            <DreamTeamSection
              teams={dtTeams}
              meId={user.id}
              candidates={dtCandidates}
            />
          </div>
        </Card>
      )}

      <CardViewToggle
        cutoutUrl={profile.card_photo_cutout_url ?? null}
        data={{
          nickname: profile.nickname,
          photoUrl: profile.card_photo_url ?? profile.avatar_url,
          positions: (positions ?? []).map((p) => p.position),
          heightCm: profile.height_cm,
          weightKg: profile.weight_kg,
          ovr,
          tier,
          gamesPlayed: stats?.games_played ?? 0,
          ppg: stats?.ppg ?? 0,
          rpg: stats?.rpg ?? 0,
          apg: stats?.apg ?? 0,
          spg: stats?.spg ?? 0,
          bpg: stats?.bpg ?? 0,
          fgPct: stats?.fg_pct ?? null,
        }}
      />

      {profile.line_id && (
        <div className="flex justify-center">
          <a
            href={`https://line.me/R/ti/p/${profile.line_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current"><path d="M19.36 2.64C17.28.56 13.78.07 10.67.02 5.37-.05 1 3.52 1 8.13c0 2.4 1.2 4.54 3.14 6.02.28.21.44.55.43.9l-.1 1.8c-.05.86.84 1.44 1.6 1.04l2.02-1.07c.24-.13.52-.18.79-.14.73.11 1.48.17 2.25.17 1.94 0 3.74-.42 5.17-1.18C21.57 12.87 23 9.79 23 6.6c0-1.58-.55-3.06-1.6-4.28.02 0 .42-.2.96.32z"/></svg>
            เพิ่มเพื่อน LINE
          </a>
        </div>
      )}

      <ShareCardButton profileId={playerId} />

      {stats && stats.games_played > 0 && (
        <Card>
          <CardTitle>ค่าเฉลี่ยต่อเกม</CardTitle>
          <div className="mt-3 grid grid-cols-5 gap-3 text-center">
              {(
                [
                  [stats.ppg.toFixed(1), "แต้ม"],
                  [stats.rpg.toFixed(1), "รีบาวด์"],
                  [stats.apg.toFixed(1), "แอสซิสต์"],
                  [stats.spg.toFixed(1), "สตีล"],
                  [stats.bpg.toFixed(1), "บล็อก"],
                ] as const
              ).map(([v, l]) => (
              <div key={l}>
                <p className="font-display text-2xl font-bold tabular-nums">
                  {v}
                </p>
                <p className="text-xs text-ink-faint">{l}</p>
              </div>
            ))}
          </div>
          {stats.mvp_count > 0 && (
            <p className="mt-3 text-center text-sm text-amber-400">
              ⭐ MVP {stats.mvp_count} ครั้ง
            </p>
          )}
        </Card>
      )}

      {log && log.length > 0 && (
        <Card>
          <CardTitle>Session ล่าสุด</CardTitle>
          <ul className="mt-2 divide-y divide-white/5">
            {log.map((g) => {
              const game = g.games as unknown as {
                id: string;
                title: string;
                starts_at: string;
              } | null;
              return (
                <li key={g.id} className="py-2.5">
                  <Link
                    href={game ? `/games/${game.id}/stats` : "#"}
                    className="flex items-center justify-between gap-3 text-sm"
                  >
                    <span className="min-w-0">
                      <span className="block truncate">
                        {g.is_mvp && "⭐ "}
                        {game?.title ?? "Session"}
                      </span>
                      <span className="text-xs text-ink-faint">
                        {game ? formatThaiDateTime(game.starts_at) : ""}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums text-ink-dim">
                      <b className="text-ink">{g.points}</b> pts ·{" "}
                      {g.reb_off + g.reb_def} reb · {g.assists} ast · {g.steals} stl · {g.blocks} blk
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>💬 คอมเมนต์</CardTitle>
        <div className="mt-2">
          <ProfileComments
            targetId={playerId}
            meId={user.id}
            comments={comments}
          />
        </div>
      </Card>
    </main>
  );
}


