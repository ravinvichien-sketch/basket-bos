import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { computeOvr, tierOf, type SeasonStats } from "@/features/stats/lib/ratings";
import { CardViewToggle } from "@/features/stats/components/card-view-toggle";
import { ShareCardButton } from "@/features/stats/components/share-card-button";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/format";

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
  const isMe = playerId === user.id;

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
          <CardTitle>เกมล่าสุด</CardTitle>
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
                        {game?.title ?? "เกม"}
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
    </main>
  );
}
