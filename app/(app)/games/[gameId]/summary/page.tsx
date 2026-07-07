import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { computeStandings, type TeamStanding } from "@/features/stats/lib/standings";
import {
  SessionLeaders,
  type LeaderStatRow,
} from "@/features/stats/components/session-leaders";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatThaiDateTime } from "@/lib/format";

interface MatchRow {
  id: string;
  team_a: string | null;
  team_b: string | null;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
  status: string;
  is_warmup: boolean;
  created_at: string;
}

interface StatRow {
  profile_id: string;
  match_id: string | null;
  points: number;
  assists: number;
  reb_off: number;
  reb_def: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fouls: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
}

interface PlayerInfo {
  id: string;
  nickname: string;
  avatar_url: string | null;
}

export default async function SummaryPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase } = await getAdminContext();

  const [{ data: game }, { data: matches }, { data: stats }, { data: teamsData }] =
    await Promise.all([
      supabase
        .from("games")
        .select("id, title, starts_at, groups(name)")
        .eq("id", gameId)
        .single(),
      supabase
        .from("matches")
        .select(
          "id, team_a, team_b, team_a_name, team_b_name, score_a, score_b, status, created_at, is_warmup"
        )
        .eq("game_id", gameId)
        .order("created_at"),
      supabase
        .from("player_game_stats")
        .select(
          "profile_id, match_id, points, assists, reb_off, reb_def, steals, blocks, turnovers, fouls, fgm, fga, tpm, tpa, ftm, fta"
        )
        .eq("game_id", gameId),
      supabase
        .from("teams")
        .select("id, name, color")
        .eq("game_id", gameId)
        .order("name"),
    ]);
  if (!game) notFound();

  const allMatches = (matches ?? []) as unknown as MatchRow[];
  const finishedMatches = allMatches.filter((m) => m.status !== "pending");
  const statRows = (stats ?? []) as unknown as StatRow[];

  const teams = (teamsData ?? []) as { id: string; name: string; color: string }[];
  const nameOf = (id: string | null) => {
    if (!id) return "ทีม";
    const t = teams.find((t) => t.id === id);
    return t?.name ?? "ทีม";
  };
  const colorOf = (id: string | null) => {
    if (!id) return "#94a3b8";
    const t = teams.find((t) => t.id === id);
    return t?.color ?? "#94a3b8";
  };

  // Aggregate stats per player (sum across all games)
  const playerTotals = new Map<
    string,
    { points: number; assists: number; reb: number; steals: number; blocks: number; fouls: number; games: number }
  >();
  for (const s of statRows) {
    const cur = playerTotals.get(s.profile_id) ?? {
      points: 0, assists: 0, reb: 0, steals: 0, blocks: 0, fouls: 0, games: 0,
    };
    cur.points += s.points;
    cur.assists += s.assists;
    cur.reb += s.reb_off + s.reb_def;
    cur.steals += s.steals;
    cur.blocks += s.blocks;
    cur.fouls += s.fouls;
    cur.games += 1;
    playerTotals.set(s.profile_id, cur);
  }

  // Get player profile info
  const playerIds = [...new Set(statRows.map((s) => s.profile_id))];
  const { data: playerProfiles } = await supabase
    .from("profiles")
    .select("id, nickname, avatar_url")
    .in("id", playerIds);

  const players = (playerProfiles ?? []) as PlayerInfo[];
  const playerInfo = new Map(players.map((p) => [p.id, p]));

  // Per-game stats breakdown
  const perMatchStats = new Map<string, { matchId: string; teamA: string; teamB: string; scoreA: number; scoreB: number; stats: { id: string; nickname: string; avatar_url: string | null; points: number; assists: number; reb: number; steals: number; blocks: number }[] }>();
  for (const m of finishedMatches) {
    const matchStats = statRows
      .filter((s) => s.match_id === m.id)
      .map((s) => {
        const p = playerInfo.get(s.profile_id);
        return {
          id: s.profile_id,
          nickname: p?.nickname ?? "ผู้เล่น",
          avatar_url: p?.avatar_url ?? null,
          points: s.points,
          assists: s.assists,
          reb: s.reb_off + s.reb_def,
          steals: s.steals,
          blocks: s.blocks,
        };
      });
    perMatchStats.set(m.id, {
      matchId: m.id,
      teamA: nameOf(m.team_a),
      teamB: nameOf(m.team_b),
      scoreA: m.score_a,
      scoreB: m.score_b,
      stats: matchStats,
    });
  }

  // For aggregate leaders
  const leaderRows: LeaderStatRow[] = Array.from(playerTotals.entries()).map(
    ([profile_id, t]) => ({
      profile_id,
      points: t.points,
      reb_off: t.reb,
      reb_def: 0,
      assists: t.assists,
      steals: t.steals,
      blocks: t.blocks,
    })
  );
  const leaderPlayers = players.map((p) => ({
    profileId: p.id,
    nickname: p.nickname,
    avatarUrl: p.avatar_url,
  }));
  const hasStats = leaderRows.some((r) => r.points > 0);

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">สรุป Session 📊</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
        <p className="text-xs text-ink-faint">
          {(game.groups as { name?: string } | null)?.name} ·{" "}
          {formatThaiDateTime(game.starts_at)} · {finishedMatches.length} เกมส์ ·{" "}
          {playerTotals.size} คน
        </p>
      </header>

      {/* Team standings */}
      {finishedMatches.length > 0 && (
        <Card>
          <CardTitle>🏆 อันดับทีม</CardTitle>
          <div className="mt-3 space-y-1">
            {(
              computeStandings(
                finishedMatches as { id: string; team_a: string | null; team_b: string | null; team_a_name: string | null; team_b_name: string | null; score_a: number; score_b: number; is_warmup: boolean }[],
                nameOf,
                colorOf
              ) as TeamStanding[]
            ).map((s, i) => (
              <div
                key={s.teamId}
                className="flex items-center gap-3 py-2 px-3 rounded-lg bg-surface-overlay/50"
              >
                <span className="w-6 text-center text-sm">
                  {["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣"][i] ?? `${i + 1}.`}
                </span>
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="flex-1 text-sm font-semibold">{s.name}</span>
                <span className="text-xs text-ink-dim">
                  <span className={cn(s.wins > 0 && "text-emerald-400 font-bold")}>{s.wins}W</span>
                  {" / "}
                  <span className={cn(s.losses > 0 && "text-red-400 font-bold")}>{s.losses}L</span>
                  {s.draws > 0 && <span className="text-ink-faint"> / {s.draws}D</span>}
                </span>
                <span className="text-xs tabular-nums text-ink-dim">
                  PF <b>{s.pointsFor}</b> · PA <b>{s.pointsAgainst}</b>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Each game result */}
      {finishedMatches.length > 0 && (
        <Card>
          <CardTitle>ทุกรายการเกมส์</CardTitle>
          <div className="mt-3 space-y-4">
            {finishedMatches.map((m, i) => {
              const ps = perMatchStats.get(m.id);
              return (
                <div key={m.id} className="rounded-xl bg-surface-overlay/50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-faint">เกมส์ที่ {i + 1}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex-1 text-right font-semibold">{nameOf(m.team_a)}</span>
                    <span className="rounded-lg bg-surface-overlay px-3 py-1 font-black tabular-nums">
                      {m.score_a} - {m.score_b}
                    </span>
                    <span className="flex-1 font-semibold">{nameOf(m.team_b)}</span>
                  </div>
                  {ps && ps.stats.length > 0 && (
                    <div className="grid grid-cols-1 gap-1 text-xs text-ink-faint pl-2 border-l-2 border-white/5">
                      {ps.stats.map((s) => (
                        <div key={s.id} className="flex items-center gap-1.5">
                          {s.avatar_url ? (
                            <Image src={s.avatar_url} alt="" width={16} height={16} className="rounded-full" />
                          ) : (
                            <span className="h-4 w-4 rounded-full bg-surface-overlay flex items-center justify-center text-[8px]">🏀</span>
                          )}
                          <span className="flex-1 truncate">{s.nickname}</span>
                          <span>{s.points} pts</span>
                          {s.assists > 0 && <span>{s.assists} ast</span>}
                          {s.reb > 0 && <span>{s.reb} reb</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Aggregate leaders */}
      {hasStats && (
        <Card>
          <CardTitle>ผู้เล่นเด่นทั้ง Session 🏅</CardTitle>
          <div className="mt-3">
            <SessionLeaders rows={leaderRows} players={leaderPlayers} />
          </div>
        </Card>
      )}

      {/* Aggregate stats table */}
      {playerTotals.size > 0 && (
        <Card>
          <CardTitle>สถิติรวมทั้ง Session</CardTitle>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-ink-faint border-b border-white/5">
                  <th className="text-left py-2 pr-2">ผู้เล่น</th>
                  <th className="text-right px-1.5 py-2">เกมส์</th>
                  <th className="text-right px-1.5 py-2">PTS</th>
                  <th className="text-right px-1.5 py-2">AST</th>
                  <th className="text-right px-1.5 py-2">REB</th>
                  <th className="text-right px-1.5 py-2">STL</th>
                  <th className="text-right px-1.5 py-2">BLK</th>
                  <th className="text-right pl-1.5 py-2">PTS/G</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(playerTotals.entries())
                  .sort(([, a], [, b]) => b.points - a.points)
                  .map(([pid, t]) => {
                    const p = playerInfo.get(pid);
                    return (
                      <tr key={pid} className="border-b border-white/5 hover:bg-surface-overlay/30">
                        <td className="py-2 pr-2">
                          <span className="flex items-center gap-1.5">
                            {p?.avatar_url ? (
                              <Image src={p.avatar_url} alt="" width={18} height={18} className="rounded-full" />
                            ) : (
                              <span className="h-[18px] w-[18px] rounded-full bg-surface-overlay flex items-center justify-center text-[8px]">🏀</span>
                            )}
                            <span className="truncate">{p?.nickname ?? "ผู้เล่น"}</span>
                          </span>
                        </td>
                        <td className="text-right px-1.5 py-2 tabular-nums">{t.games}</td>
                        <td className="text-right px-1.5 py-2 font-bold tabular-nums">{t.points}</td>
                        <td className="text-right px-1.5 py-2 tabular-nums">{t.assists}</td>
                        <td className="text-right px-1.5 py-2 tabular-nums">{t.reb}</td>
                        <td className="text-right px-1.5 py-2 tabular-nums">{t.steals}</td>
                        <td className="text-right px-1.5 py-2 tabular-nums">{t.blocks}</td>
                        <td className="text-right pl-1.5 py-2 tabular-nums font-semibold">
                          {t.games > 0 ? (t.points / t.games).toFixed(1) : "0.0"}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {!hasStats && finishedMatches.length === 0 && (
        <Card className="py-12 text-center text-sm text-ink-faint">
          ยังไม่มีเกมส์ใน Session นี้
        </Card>
      )}

      <div className="flex gap-2">
        <Link
          href={`/games/${gameId}/live`}
          className="flex-1 flex h-11 items-center justify-center rounded-xl bg-court text-sm font-semibold text-white hover:bg-court-dark transition"
        >
          🔴 จดสกอร์สด
        </Link>
        <Link
          href={`/games/${gameId}/stats`}
          className="flex-1 flex h-11 items-center justify-center rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition"
        >
          📊 กรอกสถิติ
        </Link>
      </div>
    </main>
  );
}
