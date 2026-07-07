import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GameCard } from "@/features/games/components/game-card";
import { NotificationBanner } from "@/features/notifications/components/notification-banner";
import { PlayerCard } from "@/features/stats/components/player-card";
import {
  computeOvr,
  tierOf,
  type SeasonStats,
} from "@/features/stats/lib/ratings";
import type { Game } from "@/types/database";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    { data: positions },
    { data: upcomingGames },
    { data: unreadNotifications },
    { data: unpaidPayments },
  ] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase
        .from("player_positions")
        .select("position, priority")
        .eq("profile_id", user.id)
        .order("priority"),
      supabase
        .from("games")
        .select("*")
        .in("status", ["open", "closed", "in_progress"])
        .gte("ends_at", new Date().toISOString())
        .order("starts_at", { ascending: true })
        .limit(3),
      supabase
        .from("notifications")
        .select("id, type, payload, created_at")
        .eq("profile_id", user.id)
        .neq("status", "read")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("payments")
        .select("id, amount_thb, games(id, title)")
        .eq("profile_id", user.id)
        .eq("status", "unpaid")
        .limit(3),
    ]);

  const { data: season } = await supabase
    .from("v_player_season_stats")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (!profile) redirect("/onboarding");

  const counts = new Map<string, number>();
  if (upcomingGames && upcomingGames.length > 0) {
    const { data: countRows } = await supabase
      .from("v_game_counts")
      .select("game_id, confirmed_count")
      .in(
        "game_id",
        upcomingGames.map((g) => g.id)
      );
    countRows?.forEach((r) =>
      counts.set(r.game_id as string, Number(r.confirmed_count))
    );
  }

  const seasonStats: SeasonStats | null = season
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
  const ovr = computeOvr(seasonStats);
  const tier = tierOf(ovr);

  return (
    <main className="px-5 py-8 space-y-6">
      <header>
        <p className="text-sm text-ink-dim">สวัสดี 👋</p>
        <h1 className="text-2xl font-extrabold">{profile.nickname}</h1>
      </header>

      <NotificationBanner notifications={unreadNotifications ?? []} />

      {unpaidPayments && unpaidPayments.length > 0 && (
        <div className="rounded-xl2 bg-red-500/10 border border-red-500/30 p-4 space-y-1.5">
          <p className="text-sm font-bold text-red-400">💰 ยอดค้างจ่าย</p>
          {unpaidPayments.map((p) => {
            const g = p.games as unknown as { id: string; title: string } | null;
            return (
              <Link
                key={p.id}
                href={g ? `/games/${g.id}/payments` : "/games"}
                className="block text-sm hover:underline"
              >
                {g?.title ?? "Session"} — ฿{p.amount_thb.toLocaleString()} →
              </Link>
            );
          })}
        </div>
      )}

      <Link href={`/players/${user.id}`} className="block">
        <PlayerCard
          data={{
            nickname: profile.nickname,
            photoUrl: profile.card_photo_url ?? profile.avatar_url,
            positions: (positions ?? []).map((p) => p.position),
            heightCm: profile.height_cm,
            weightKg: profile.weight_kg,
            ovr,
            tier,
            gamesPlayed: seasonStats?.games_played ?? 0,
            ppg: seasonStats?.ppg ?? 0,
            rpg: seasonStats?.rpg ?? 0,
            apg: seasonStats?.apg ?? 0,
            spg: seasonStats?.spg ?? 0,
            bpg: seasonStats?.bpg ?? 0,
            fgPct: seasonStats?.fg_pct ?? null,
          }}
        />
      </Link>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <CardTitle>Session ที่กำลังจะมาถึง</CardTitle>
          <Link href="/games" className="text-xs text-court font-semibold">
            ดูทั้งหมด →
          </Link>
        </div>
        {upcomingGames && upcomingGames.length > 0 ? (
          upcomingGames.map((game) => (
            <GameCard
              key={game.id}
              game={game as Game}
              confirmedCount={counts.get(game.id)}
            />
          ))
        ) : (
          <Card className="py-8 text-center text-ink-faint text-sm">
            ยังไม่มี Session เปิดรับสมัคร
          </Card>
        )}
      </section>

      <div className="grid grid-cols-3 gap-3">
        {[
          ["Session ที่เล่น", String(seasonStats?.games_played ?? 0)],
          [
            "แต้มเฉลี่ย",
            seasonStats && seasonStats.games_played > 0
              ? seasonStats.ppg.toFixed(1)
              : "–",
          ],
          [
            "รีบาวด์เฉลี่ย",
            seasonStats && seasonStats.games_played > 0
              ? seasonStats.rpg.toFixed(1)
              : "–",
          ],
        ].map(([label, value]) => (
          <Card key={label} className="text-center py-3">
            <p className="font-display text-2xl font-bold tabular-nums">
              {value}
            </p>
            <p className="text-xs text-ink-faint mt-0.5">{label}</p>
          </Card>
        ))}
      </div>

      {profile.role === "admin" && (
        <div className="flex items-center justify-between gap-3">
          <Badge>ผู้ดูแลก๊วน</Badge>
          <Link
            href="/groups"
            className="flex h-11 items-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 px-4 text-sm font-semibold hover:border-court/40 transition"
          >
            👥 จัดการก๊วน
          </Link>
        </div>
      )}
    </main>
  );
}
