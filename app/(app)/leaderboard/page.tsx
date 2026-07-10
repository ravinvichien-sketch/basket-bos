import Image from "next/image";
import Link from "next/link";
import { getAdminContext } from "@/features/auth/guards";
import { computeOvr, tierOf, type SeasonStats } from "@/features/stats/lib/ratings";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TIER_CHIP: Record<string, string> = {
  bronze: "bg-orange-900/40 text-orange-300",
  silver: "bg-slate-500/20 text-slate-300",
  gold: "bg-amber-500/20 text-amber-400",
  holo: "bg-fuchsia-500/20 text-fuchsia-400",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ group?: string }>;
}) {
  const { supabase, user, isAdmin } = await getAdminContext();
  const { group: groupParam } = await searchParams;

  const [{ data: profiles }, { data: seasons }, { data: groups }, { data: gm }, { data: myMemberships }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, nickname, avatar_url, card_photo_url")
        .eq("onboarded", true),
      supabase.from("v_player_season_stats").select("*"),
      supabase
        .from("groups")
        .select("id, name")
        .is("deleted_at", null)
        .order("name"),
      supabase.from("group_members").select("group_id, profile_id"),
      supabase
        .from("group_members")
        .select("group_id")
        .eq("profile_id", user.id),
    ]);

  const myGroupIds = new Set((myMemberships ?? []).map((m) => m.group_id));
  const groupList = (groups ?? []).filter(
    (g) => isAdmin || myGroupIds.has(g.id)
  ) as { id: string; name: string }[];
  const activeGroup = groupList.find((g) => g.id === groupParam) ?? null;
  // profileIds ที่อยู่ในก๊วนที่เลือก
  const memberIds = activeGroup
    ? new Set(
        (gm ?? [])
          .filter((m) => m.group_id === activeGroup.id)
          .map((m) => m.profile_id)
      )
    : null;

  const seasonMap = new Map((seasons ?? []).map((s) => [s.profile_id, s]));

  const ranked = (profiles ?? [])
    .filter((p) => !memberIds || memberIds.has(p.id))
    .map((p) => {
      const s = seasonMap.get(p.id);
      const stats: SeasonStats | null = s
        ? {
            games_played: Number(s.games_played),
            total_minutes: Number(s.total_minutes ?? 0),
            total_points: Number(s.total_points ?? 0),
            total_fgm: Number(s.total_fgm ?? 0),
            total_fga: Number(s.total_fga ?? 0),
            total_tpm: Number(s.total_tpm ?? 0),
            total_tpa: Number(s.total_tpa ?? 0),
            total_ftm: Number(s.total_ftm ?? 0),
            total_fta: Number(s.total_fta ?? 0),
            total_reb_off: Number(s.total_reb_off ?? 0),
            total_reb_def: Number(s.total_reb_def ?? 0),
            total_assists: Number(s.total_assists ?? 0),
            total_steals: Number(s.total_steals ?? 0),
            total_blocks: Number(s.total_blocks ?? 0),
            total_turnovers: Number(s.total_turnovers ?? 0),
            total_fouls: Number(s.total_fouls ?? 0),
            total_plus_minus: Number(s.total_plus_minus ?? 0),
            ppg: Number(s.ppg ?? 0),
            rpg: Number(s.rpg ?? 0),
            apg: Number(s.apg ?? 0),
            spg: Number(s.spg ?? 0),
            bpg: Number(s.bpg ?? 0),
            fg_pct: s.fg_pct != null ? Number(s.fg_pct) : null,
            tp_pct: s.tp_pct != null ? Number(s.tp_pct) : null,
            mvp_count: Number(s.mvp_count ?? 0),
          }
        : null;
      const ovr = computeOvr(stats);
      return { ...p, stats, ovr, tier: tierOf(ovr) };
    })
    .sort((a, b) => b.ovr - a.ovr);

  const withGames = ranked.filter((r) => (r.stats?.games_played ?? 0) > 0);
  const leaders = (key: "ppg" | "rpg" | "apg" | "spg" | "bpg") =>
    [...withGames].sort((a, b) => (b.stats![key] ?? 0) - (a.stats![key] ?? 0)).slice(0, 3);

  const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;

  return (
    <main className="px-5 py-8 space-y-5">
      <h1 className="text-2xl font-extrabold">จัดอันดับ 🏆</h1>

      {groupList.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <Link
            href="/leaderboard"
            className={cn(
              "h-9 rounded-full px-3.5 flex items-center text-sm font-semibold transition",
              !activeGroup
                ? "bg-court text-white"
                : "bg-surface-overlay text-ink-dim hover:text-ink"
            )}
          >
            ทั้งหมด
          </Link>
          {groupList.map((g) => (
            <Link
              key={g.id}
              href={`/leaderboard?group=${g.id}`}
              className={cn(
                "h-9 rounded-full px-3.5 flex items-center text-sm font-semibold transition",
                activeGroup?.id === g.id
                  ? "bg-court text-white"
                  : "bg-surface-overlay text-ink-dim hover:text-ink"
              )}
            >
              {g.name}
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardTitle>
          Overall Rating
          {activeGroup && (
            <span className="text-ink-faint font-normal"> · {activeGroup.name}</span>
          )}
        </CardTitle>
        <ol className="mt-2 divide-y divide-white/5">
          {ranked.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/players/${p.id}`}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  p.id === user.id && "text-court"
                )}
              >
                <span className="w-8 text-center text-sm">{medal(i)}</span>
                {p.avatar_url ? (
                  <Image
                    src={p.avatar_url}
                    alt=""
                    width={32}
                    height={32}
                    className="rounded-full"
                  />
                ) : (
                  <span className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
                    🏀
                  </span>
                )}
                <span className="flex-1 truncate text-sm font-semibold">
                  {p.nickname}
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-black",
                    TIER_CHIP[p.tier.key]
                  )}
                >
                  {p.tier.label}
                </span>
                <span className="font-display w-10 text-right text-lg font-bold tabular-nums">
                  {p.ovr}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      </Card>

      {withGames.length > 0 && (
        <div className="grid gap-4">
          {(
            [
              ["ppg", "🔥 แต้มต่อเกม"],
              ["rpg", "💪 รีบาวด์ต่อเกม"],
              ["apg", "🎯 แอสซิสต์ต่อเกม"],
              ["spg", "🖐 สตีลต่อเกม"],
              ["bpg", "🔒 บล็อกต่อเกม"],
            ] as const
          ).map(([key, title]) => (
            <Card key={key}>
              <CardTitle>{title}</CardTitle>
              <ol className="mt-2 space-y-1.5">
                {leaders(key).map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 text-sm">
                    <span className="w-6">{medal(i)}</span>
                    <Link
                      href={`/players/${p.id}`}
                      className="flex-1 truncate hover:underline"
                    >
                      {p.nickname}
                    </Link>
                    <span className="font-bold tabular-nums">
                      {(p.stats![key] ?? 0).toFixed(1)}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          ))}
        </div>
      )}

      {ranked.length === 0 && (
        <p className="text-center text-sm text-ink-faint py-4">
          ยังไม่มีสมาชิกในก๊วนนี้
        </p>
      )}

      {ranked.length > 0 && withGames.length === 0 && (
        <p className="text-center text-sm text-ink-faint py-4">
          ยังไม่มีสถิติจากเกม — ทุกคนเริ่มที่ 50 เท่ากัน เล่นบ่อย/เล่นดีแล้วคะแนนขึ้นเอง
        </p>
      )}
    </main>
  );
}
