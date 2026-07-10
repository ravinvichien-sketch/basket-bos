import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PlayerCardGenerator } from "@/features/stats/components/player-card-generator";
import { createClient } from "@/lib/supabase/server";

interface StatRow {
  profile_id: string;
  match_id: string | null;
  team_id: string | null;
  points: number;
  assists: number;
  reb_off: number;
  reb_def: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  minutes: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  is_mvp: boolean;
  plus_minus: number | null;
}

interface MatchRow {
  id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
  status: string;
  created_at: string;
}

interface CardGenRow {
  id: string;
  card_url: string | null;
  ai_image_url: string | null;
  created_at: string;
}

export default async function MyStatsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, user, isAdmin } = await getAdminContext();

  const [
    { data: game },
    { data: matches },
    { data: stats },
    { data: teamsData },
    { data: myCard },
    { data: allCards },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, location, starts_at, groups(name)")
      .eq("id", gameId)
      .single(),
    supabase
      .from("matches")
      .select("id, team_a_name, team_b_name, score_a, score_b, status, created_at")
      .eq("game_id", gameId)
      .eq("status", "finished")
      .order("created_at"),
    supabase
      .from("player_game_stats")
      .select("profile_id, match_id, team_id, points, assists, reb_off, reb_def, steals, blocks, turnovers, fouls, minutes, fgm, fga, tpm, tpa, ftm, fta, is_mvp, plus_minus")
      .eq("game_id", gameId)
      .eq("profile_id", user.id),
    supabase
      .from("teams")
      .select("id, name, color")
      .eq("game_id", gameId)
      .order("name"),
    supabase
      .from("player_card_generations")
      .select("id, card_url, ai_image_url, created_at")
      .eq("game_id", gameId)
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase
      .from("player_card_generations")
      .select("id, game_id, profile_id, card_url, ai_image_url, created_at")
      .eq("game_id", gameId)
      .not("card_url", "is", null)
      .order("created_at", { ascending: false }),
  ]);
  if (!game) notFound();

  const myStats = (stats ?? []) as StatRow[];
  const finishedMatches = (matches ?? []) as MatchRow[];
  const teams = (teamsData ?? []) as { id: string; name: string; color: string }[];
  const myCardGen = myCard as CardGenRow | null;
  const othersCards = (allCards ?? [])
    .filter((c) => c.profile_id !== user.id) as (CardGenRow & { profile_id: string })[];

  // Get names for other players' cards
  const otherProfileIds = [...new Set(othersCards.map((c) => c.profile_id))];
  const { data: otherProfiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", otherProfileIds);
  const profileMap = new Map(
    (otherProfiles ?? []).map((p) => [p.id, p])
  );
  const cardTeamOf = new Map<string, string>();
  if (teams.length > 0) {
    const { data: tmRows } = await supabase
      .from("team_members")
      .select("team_id, profile_id")
      .in("team_id", teams.map((t) => t.id));
    for (const row of tmRows ?? []) cardTeamOf.set(row.profile_id, row.team_id);
  }

  // Compute aggregate stats
  const totals = {
    games: myStats.length,
    points: 0, assists: 0, reb_off: 0, reb_def: 0,
    steals: 0, blocks: 0, turnovers: 0, fouls: 0, minutes: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0,
    mvpCount: 0, plusMinus: 0,
  };
  for (const s of myStats) {
    totals.points += s.points;
    totals.assists += s.assists;
    totals.reb_off += s.reb_off;
    totals.reb_def += s.reb_def;
    totals.steals += s.steals;
    totals.blocks += s.blocks;
    totals.turnovers += s.turnovers;
    totals.fouls += s.fouls;
    totals.minutes += s.minutes;
    totals.fgm += s.fgm; totals.fga += s.fga;
    totals.tpm += s.tpm; totals.tpa += s.tpa;
    totals.ftm += s.ftm; totals.fta += s.fta;
    if (s.is_mvp) totals.mvpCount += 1;
    totals.plusMinus += s.plus_minus ?? 0;
  }

  const fgPct = totals.fga > 0 ? Math.round((totals.fgm / totals.fga) * 100) : null;
  const tpPct = totals.tpa > 0 ? Math.round((totals.tpm / totals.tpa) * 100) : null;
  const ftPct = totals.fta > 0 ? Math.round((totals.ftm / totals.fta) * 100) : null;
  const ppg = totals.games > 0 ? (totals.points / totals.games).toFixed(1) : "0";
  const rpg = totals.games > 0 ? ((totals.reb_off + totals.reb_def) / totals.games).toFixed(1) : "0";
  const apg = totals.games > 0 ? (totals.assists / totals.games).toFixed(1) : "0";

  return (
    <main className="px-5 py-8 space-y-5 max-w-2xl mx-auto">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">สถิติของฉัน 🏀</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
        <p className="text-xs text-ink-faint">
          {(game.groups as { name?: string } | null)?.name} ·{" "}
          {formatThaiDateTime(game.starts_at)} · {totals.games} เกมส์
        </p>
      </header>

      {myStats.length === 0 ? (
        <Card className="py-12 text-center text-sm text-ink-faint">
          คุณยังไม่มีสถิติใน Session นี้
        </Card>
      ) : (
        <>
          {/* Key stats cards - Bento style */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 text-center">
              <p className="text-3xl font-black text-court tabular-nums">{totals.points}</p>
              <p className="text-xs text-ink-dim mt-1">คะแนนรวม</p>
              <p className="text-[10px] text-ink-faint">{ppg} ต่อเกม</p>
            </div>
            <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 text-center">
              <p className="text-3xl font-black text-amber-400 tabular-nums">{totals.assists}</p>
              <p className="text-xs text-ink-dim mt-1">แอสซิสต์</p>
              <p className="text-[10px] text-ink-faint">{apg} ต่อเกม</p>
            </div>
            <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 text-center">
              <p className="text-3xl font-black text-emerald-400 tabular-nums">{totals.reb_off + totals.reb_def}</p>
              <p className="text-xs text-ink-dim mt-1">รีบาวด์</p>
              <p className="text-[10px] text-ink-faint">{rpg} ต่อเกม</p>
            </div>
            <div className="rounded-xl2 bg-surface-raised border border-white/5 p-4 text-center">
              <p className="text-3xl font-black text-blue-400 tabular-nums">{totals.steals + totals.blocks}</p>
              <p className="text-xs text-ink-dim mt-1">สตีล + บล็อก</p>
              <p className="text-[10px] text-ink-faint">{totals.turnovers} turnover</p>
            </div>
          </div>

          {/* Shooting percent */}
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{fgPct !== null ? `${fgPct}%` : "-"}</p>
              <p className="text-[10px] text-ink-dim">2PT</p>
              <p className="text-[9px] text-ink-faint">{totals.fgm}/{totals.fga}</p>
            </div>
            <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{tpPct !== null ? `${tpPct}%` : "-"}</p>
              <p className="text-[10px] text-ink-dim">3PT</p>
              <p className="text-[9px] text-ink-faint">{totals.tpm}/{totals.tpa}</p>
            </div>
            <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
              <p className="text-lg font-bold tabular-nums">{ftPct !== null ? `${ftPct}%` : "-"}</p>
              <p className="text-[10px] text-ink-dim">FT</p>
              <p className="text-[9px] text-ink-faint">{totals.ftm}/{totals.fta}</p>
            </div>
          </div>

          {/* Game-by-game breakdown */}
          <Card>
            <CardTitle>ผลงานแต่ละเกม</CardTitle>
            <div className="mt-3 space-y-2">
              {myStats.map((s, i) => {
                const match = finishedMatches.find((m) => m.id === s.match_id);
                const reb = s.reb_off + s.reb_def;
                const gs = s.points + 0.7 * s.assists + 0.7 * reb + s.steals + 0.7 * s.blocks - 0.4 * s.fouls - s.turnovers;
                return (
                  <div key={s.match_id ?? i} className="flex items-center gap-2 rounded-lg bg-surface-overlay/50 px-3 py-2 text-xs">
                    {match ? (
                      <span className="text-ink-faint shrink-0 w-16 truncate">
                        {match.team_a_name ?? "?"} vs {match.team_b_name ?? "?"}
                      </span>
                    ) : (
                      <span className="text-ink-faint shrink-0">Manual</span>
                    )}
                    <span className="flex-1 text-right font-semibold tabular-nums">
                      {s.points}P {s.assists}A {reb}R
                    </span>
                    {s.is_mvp && <span className="text-[10px]">👑</span>}
                    <span className={cn("tabular-nums", gs >= 10 ? "text-court font-bold" : "text-ink-faint")}>
                      GS: {gs.toFixed(1)}
                    </span>
                    <span className="text-ink-faint tabular-nums w-10 text-right">
                      {s.minutes}m
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Card generation */}
          <Card>
            <CardTitle>การ์ดสถิติของฉัน</CardTitle>
            <div className="mt-3 text-center">
              <PlayerCardGenerator
                gameId={gameId}
                profileId={user.id}
                totals={totals}
                fgPct={fgPct}
                tpPct={tpPct}
                ftPct={ftPct}
                ppg={ppg}
                rpg={rpg}
                apg={apg}
                gameTitle={game.title}
                gameLocation={game.location ?? ""}
                gameDate={formatThaiDateTime(game.starts_at)}
                existingCard={myCardGen}
                matches={finishedMatches}
                perMatchStats={myStats}
              />
            </div>
          </Card>

          {/* Other players' cards */}
          {othersCards.length > 0 && (
            <Card>
              <CardTitle>การ์ดของคนอื่น 🏀</CardTitle>
              <div className="mt-3 grid grid-cols-2 gap-3">
                {othersCards.map((c) => {
                  const p = profileMap.get(c.profile_id);
                  return (
                    <div key={c.id} className="rounded-xl bg-surface-overlay/50 overflow-hidden">
                      {c.card_url && (
                        <Link href={c.card_url} target="_blank">
                          <Image
                            src={c.card_url}
                            alt={`${p?.nickname ?? "ผู้เล่น"} card`}
                            width={300}
                            height={400}
                            className="w-full aspect-[3/4] object-cover"
                          />
                        </Link>
                      )}
                      <div className="p-2 flex items-center gap-2">
                        {p?.avatar_url ? (
                          <Image src={p.avatar_url} alt="" width={20} height={20} className="rounded-full" />
                        ) : (
                          <span className="h-5 w-5 rounded-full bg-surface-overlay flex items-center justify-center text-[8px]">🏀</span>
                        )}
                        <span className="text-xs font-semibold truncate">{p?.nickname ?? "ผู้เล่น"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </main>
  );
}
