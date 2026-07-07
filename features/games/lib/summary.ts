import type { SupabaseClient } from "@supabase/supabase-js";

export interface TeamStandingSummary {
  name: string;
  color: string;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface PlayerLeaderSummary {
  nickname: string;
  value: number;
}

export interface SessionSummaryData {
  title: string;
  date: string;
  standings: TeamStandingSummary[];
  topScorer: PlayerLeaderSummary | null;
  topRebounder: PlayerLeaderSummary | null;
  topAssister: PlayerLeaderSummary | null;
  topStealer: PlayerLeaderSummary | null;
  topBlocker: PlayerLeaderSummary | null;
  mvp: { nickname: string; ovr: number } | null;
  totalPoints: number;
  totalGames: number;
}

export async function buildSessionSummary(
  supabase: SupabaseClient,
  gameId: string
): Promise<SessionSummaryData | null> {
  const { data: game } = await supabase
    .from("games")
    .select("title, starts_at")
    .eq("id", gameId)
    .single();
  if (!game) return null;

  const { data: matches } = await supabase
    .from("matches")
    .select("team_a, team_b, team_a_name, team_b_name, score_a, score_b, is_warmup")
    .eq("game_id", gameId)
    .order("created_at");

  const { data: stats } = await supabase
    .from("player_game_stats")
    .select("profile_id, points, assists, reb_off, reb_def, steals, blocks, is_mvp")
    .eq("game_id", gameId);

  const { data: teams } = await supabase
    .from("teams")
    .select("id, name, color")
    .eq("game_id", gameId);

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, nickname");

  const nameOf = (id: string) => profiles?.find((p) => p.id === id)?.nickname ?? "ผู้เล่น";
  const teamNameOf = (id: string | null) =>
    teams?.find((t) => t.id === id)?.name ?? "ทีม";
  const teamColorOf = (id: string | null) =>
    teams?.find((t) => t.id === id)?.color ?? "#94a3b8";

  // Standings
  const standings = new Map<string, TeamStandingSummary>();
  for (const m of matches ?? []) {
    if (m.is_warmup) continue;
    if (!m.team_a || !m.team_b) continue;
    for (const [id, score, oppScore] of [
      [m.team_a, m.score_a, m.score_b],
      [m.team_b, m.score_b, m.score_a],
    ] as [string, number, number][]) {
      if (!standings.has(id)) {
        standings.set(id, {
          name: teamNameOf(id),
          color: teamColorOf(id),
          wins: 0, losses: 0,
          pointsFor: 0, pointsAgainst: 0,
        });
      }
      const s = standings.get(id)!;
      s.pointsFor += score;
      s.pointsAgainst += oppScore;
      if (score > oppScore) s.wins++;
      else s.losses++;
    }
  }

  const sortedStandings = [...standings.values()].sort((a, b) => {
    const w = b.wins - a.wins;
    if (w !== 0) return w;
    return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
  });

  // Player leaders
  const totals = new Map<string, {
    points: number; reb: number; ast: number; stl: number; blk: number; is_mvp: boolean;
  }>();
  for (const s of stats ?? []) {
    const t = totals.get(s.profile_id) ?? {
      points: 0, reb: 0, ast: 0, stl: 0, blk: 0, is_mvp: false,
    };
    t.points += s.points;
    t.reb += (s.reb_off ?? 0) + (s.reb_def ?? 0);
    t.ast += s.assists;
    t.stl += s.steals;
    t.blk += s.blocks;
    if (s.is_mvp) t.is_mvp = true;
    totals.set(s.profile_id, t);
  }

  function topBy(key: "points" | "reb" | "ast" | "stl" | "blk") {
    let best: { id: string; v: number } | null = null;
    for (const [id, t] of totals) {
      const v = t[key];
      if (!best || v > best.v) best = { id, v };
    }
    return best ? { nickname: nameOf(best.id), value: best.v } : null;
  }

  const mvpEntry = [...totals.entries()].find(([, t]) => t.is_mvp);

  return {
    title: game.title,
    date: game.starts_at,
    standings: sortedStandings,
    topScorer: topBy("points"),
    topRebounder: topBy("reb"),
    topAssister: topBy("ast"),
    topStealer: topBy("stl"),
    topBlocker: topBy("blk"),
    mvp: mvpEntry ? { nickname: nameOf(mvpEntry[0]), ovr: 0 } : null,
    totalPoints: [...totals.values()].reduce((s, t) => s + t.points, 0),
    totalGames: (matches ?? []).filter((m) => !m.is_warmup).length,
  };
}
