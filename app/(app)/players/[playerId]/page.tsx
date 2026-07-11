import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { computeOvr, tierOf, type SeasonStats } from "@/features/stats/lib/ratings";
import { TIER_LABELS, TIER_COLORS } from "@/features/stats/lib/legend-cards";
import { CardViewToggle } from "@/features/stats/components/card-view-toggle";
import { ShareCardButton } from "@/features/stats/components/share-card-button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
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

  const [{ data: profile }, { data: positions }, { data: season }, { data: log }, { data: cards }] =
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
      supabase
        .from("player_card_generations")
        .select("id, card_url, nba_player_name, nba_player_tier, nba_player_image_url, created_at, games!inner(title)")
        .eq("profile_id", playerId)
        .not("card_url", "is", null)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const cardRows = (cards ?? []) as unknown as {
    id: string; card_url: string;
    nba_player_name: string | null; nba_player_tier: string | null; nba_player_image_url: string | null;
    created_at: string; games: { title: string }[];
  }[];
  if (!profile) notFound();

  const isMe = playerId === user.id;

  // Comments (with parent_id for replies — fallback if column missing)
  let rawComments: unknown[] = [];
  try {
    const r = await supabase
      .from("profile_comments")
      .select("id, content, created_at, author_id, parent_id, profiles!author_id(nickname)")
      .eq("target_id", playerId)
      .order("created_at", { ascending: false });
    rawComments = (r.data ?? []) as unknown[];
  } catch {
    // parent_id column might not exist yet
    const r = await supabase
      .from("profile_comments")
      .select("id, content, created_at, author_id, profiles!author_id(nickname)")
      .eq("target_id", playerId)
      .order("created_at", { ascending: false });
    rawComments = (r.data ?? []) as unknown[];
  }

  // Dream teams — แสดงทีมที่ playerId เป็น owner หรือเป็น member (รวม pending)
  const { data: ownedTeams } = await supabase
    .from("dream_teams")
    .select("id, name, owner_id, profiles!owner_id(nickname)")
    .eq("owner_id", playerId);

  const { data: memberTeams } = await supabase
    .from("dream_team_members")
    .select("dream_teams!inner(id, name, owner_id, profiles!owner_id(nickname))")
    .eq("profile_id", playerId);

  const rawDt = (ownedTeams ?? []) as unknown as { id: string; name: string; owner_id: string; profiles: { nickname: string } | { nickname: string }[] | null }[];
  for (const mt of (memberTeams ?? []) as unknown as { dream_teams: { id: string; name: string; owner_id: string; profiles: { nickname: string } | { nickname: string }[] | null } }[]) {
    const t = mt.dream_teams;
    if (!rawDt.some((x) => x.id === t.id)) rawDt.push(t);
  }

  const teamIds = rawDt.map((t) => t.id);
  const { data: teamMembers } = teamIds.length > 0
    ? await supabase
        .from("dream_team_members")
        .select("id, dream_team_id, profile_id, status, profiles!profile_id(nickname, avatar_url)")
        .in("dream_team_id", teamIds)
    : { data: [] };

  const dtTeams: DreamTeamView[] = rawDt.map((t) => {
    const ownerNick = Array.isArray(t.profiles)
      ? t.profiles[0]?.nickname ?? "ผู้เล่น"
      : t.profiles?.nickname ?? "ผู้เล่น";
    const members: { id: string; profile_id: string; nickname: string; avatar_url: string | null; status: string }[] = [];
    for (const m of (teamMembers ?? []) as unknown as { id: string; dream_team_id: string; profile_id: string; status: string; profiles: { nickname: string; avatar_url: string | null } | null }[]) {
      if (m.dream_team_id === t.id) {
        members.push({
          id: m.id,
          profile_id: m.profile_id,
          nickname: m.profiles?.nickname ?? "ผู้เล่น",
          avatar_url: m.profiles?.avatar_url ?? null,
          status: m.status,
        });
      }
    }
    return {
      id: t.id,
      name: t.name,
      owner_id: t.owner_id,
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
        total_minutes: Number(season.total_minutes ?? 0),
        total_points: Number(season.total_points ?? 0),
        total_fgm: Number(season.total_fgm ?? 0),
        total_fga: Number(season.total_fga ?? 0),
        total_tpm: Number(season.total_tpm ?? 0),
        total_tpa: Number(season.total_tpa ?? 0),
        total_ftm: Number(season.total_ftm ?? 0),
        total_fta: Number(season.total_fta ?? 0),
        total_reb_off: Number(season.total_reb_off ?? 0),
        total_reb_def: Number(season.total_reb_def ?? 0),
        total_assists: Number(season.total_assists ?? 0),
        total_steals: Number(season.total_steals ?? 0),
        total_blocks: Number(season.total_blocks ?? 0),
        total_turnovers: Number(season.total_turnovers ?? 0),
        total_fouls: Number(season.total_fouls ?? 0),
        total_plus_minus: Number(season.total_plus_minus ?? 0),
        ppg: Number(season.ppg ?? 0),
        rpg: Number(season.rpg ?? 0),
        apg: Number(season.apg ?? 0),
        spg: Number(season.spg ?? 0),
        bpg: Number(season.bpg ?? 0),
        fg_pct: season.fg_pct != null ? Number(season.fg_pct) : null,
        tp_pct: season.tp_pct != null ? Number(season.tp_pct) : null,
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
      parent_id?: string | null;
      profiles: { nickname: string } | null;
    };
    return {
      id: r.id,
      content: r.content,
      created_at: r.created_at,
      author_id: r.author_id,
      parent_id: r.parent_id ?? null,
      author_nickname: r.profiles?.nickname ?? "ผู้เล่น",
    };
  });

  // Group replies under parent comments
  const topComments = comments.filter((c) => !c.parent_id);
  const replyMap = new Map<string, CommentView[]>();
  for (const c of comments) {
    if (c.parent_id) {
      const existing = replyMap.get(c.parent_id) ?? [];
      existing.push(c);
      replyMap.set(c.parent_id, existing);
    }
  }
  const threaded: CommentView[] = topComments.map((c) => ({
    ...c,
    replies: replyMap.get(c.id) ?? [],
  }));

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

      {dtTeams.length > 0 && (
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
        <>
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
            <div className="mt-3 grid grid-cols-3 gap-3 text-center text-xs">
              <div>
                <span className="text-ink-dim">FG% </span>
                <span className="font-semibold">{stats.fg_pct != null ? `${stats.fg_pct}%` : "-"}</span>
              </div>
              <div>
                <span className="text-ink-dim">3P% </span>
                <span className="font-semibold">{stats.tp_pct != null ? `${stats.tp_pct}%` : "-"}</span>
              </div>
              <div>
                <span className="text-ink-dim">+/- </span>
                <span className={cn("font-semibold", stats.total_plus_minus > 0 ? "text-emerald-400" : stats.total_plus_minus < 0 ? "text-red-400" : "")}>
                  {stats.total_plus_minus > 0 ? "+" : ""}{stats.total_plus_minus}
                </span>
              </div>
            </div>
            {stats.mvp_count > 0 && (
              <p className="mt-3 text-center text-sm text-amber-400">
                ⭐ MVP {stats.mvp_count} ครั้ง
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>สถิติรวม</CardTitle>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-ink-faint border-b border-white/5">
                    <th className="text-left py-2 pr-2">รายการ</th>
                    <th className="text-right px-1.5 py-2">รวม</th>
                    <th className="text-right pl-1.5 py-2">เฉลี่ย</th>
                  </tr>
                </thead>
                <tbody>
                  {([
                    ["เกมส์", `${stats.games_played}`, `${stats.games_played}`],
                    ["นาที", `${stats.total_minutes}`, stats.games_played > 0 ? (stats.total_minutes / stats.games_played).toFixed(1) : "0"],
                    ["แต้ม", `${stats.total_points}`, stats.ppg.toFixed(1)],
                    ["FG 2 คะแนน (ทำ/ยิง)", `${stats.total_fgm - stats.total_tpm} / ${stats.total_fga - stats.total_tpa}`, (() => {
                      const a = stats.total_fga - stats.total_tpa;
                      return a > 0 ? `${Math.round(((stats.total_fgm - stats.total_tpm) / a) * 100)}%` : "-";
                    })()],
                    ["FG 3 คะแนน (ทำ/ยิง)", `${stats.total_tpm} / ${stats.total_tpa}`, stats.tp_pct != null ? `${stats.tp_pct}%` : "-"],
                    ["FG%", stats.fg_pct != null ? `${stats.fg_pct}%` : "-", ""],
                    ["ฟรีโธรว์ (ทำ/ยิง)", `${stats.total_ftm} / ${stats.total_fta}`, stats.total_fta > 0 ? `${Math.round((stats.total_ftm / stats.total_fta) * 100)}%` : "-"],
                    ["รีบาวด์รวม", `${stats.total_reb_off + stats.total_reb_def}`, stats.rpg.toFixed(1)],
                    ["  รีบาวด์รุก", `${stats.total_reb_off}`, stats.games_played > 0 ? (stats.total_reb_off / stats.games_played).toFixed(1) : "0"],
                    ["  รีบาวด์รับ", `${stats.total_reb_def}`, stats.games_played > 0 ? (stats.total_reb_def / stats.games_played).toFixed(1) : "0"],
                    ["แอสซิสต์", `${stats.total_assists}`, stats.apg.toFixed(1)],
                    ["สตีล", `${stats.total_steals}`, stats.spg.toFixed(1)],
                    ["บล็อก", `${stats.total_blocks}`, stats.bpg.toFixed(1)],
                    ["เทิร์นโอเวอร์", `${stats.total_turnovers}`, stats.games_played > 0 ? (stats.total_turnovers / stats.games_played).toFixed(1) : "0"],
                    ["ฟาวล์", `${stats.total_fouls}`, stats.games_played > 0 ? (stats.total_fouls / stats.games_played).toFixed(1) : "0"],
                    ["+/-", stats.total_plus_minus > 0 ? `+${stats.total_plus_minus}` : `${stats.total_plus_minus}`, stats.games_played > 0 ? ((stats.total_plus_minus / stats.games_played) > 0 ? "+" : "") + (stats.total_plus_minus / stats.games_played).toFixed(1) : "0"],
                  ] as const).map(([label, total, avg]) => (
                    <tr key={label} className="border-b border-white/5 hover:bg-surface-overlay/30">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{label}</td>
                      <td className="text-right px-1.5 py-1.5 tabular-nums">{total}</td>
                      <td className="text-right pl-1.5 py-1.5 tabular-nums text-ink-dim">{avg}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
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

      {(cardRows).length > 0 && (
        <Card>
          <CardTitle>🃏 คอลเลกชันการ์ดตำนาน</CardTitle>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {cardRows.map((c) => {
              const tier = (c.nba_player_tier || "solid") as keyof typeof TIER_LABELS;
              return (
                <a
                  key={c.id}
                  href={c.card_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative rounded-xl2 overflow-hidden border border-white/10 hover:border-court/40 transition"
                >
                  <Image
                    src={c.card_url}
                    alt={c.nba_player_name ?? "Card"}
                    width={360}
                    height={450}
                    className="w-full object-cover"
                  />
                  {c.nba_player_name && (
                    <div className="absolute top-2 left-2 right-2 flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 backdrop-blur-sm">
                      <span className="text-[10px] font-bold truncate text-white">
                        {c.nba_player_name}
                      </span>
                      <span
                        className="shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold"
                        style={{ backgroundColor: `${TIER_COLORS[tier]}33`, color: TIER_COLORS[tier] }}
                      >
                        {TIER_LABELS[tier]}
                      </span>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 right-2 rounded-lg bg-black/60 px-2 py-1 backdrop-blur-sm">
                    <p className="text-[9px] text-white/80 truncate">{c.games[0]?.title}</p>
                  </div>
                </a>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>💬 คอมเมนต์</CardTitle>
        <div className="mt-2">
          <ProfileComments
            targetId={playerId}
            meId={user.id}
            isOwner={isMe}
            comments={threaded}
          />
        </div>
      </Card>
    </main>
  );
}


