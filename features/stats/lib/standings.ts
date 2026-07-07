import type { MatchView } from "../components/match-section";
import type { TeamView } from "@/features/teams/components/teams-board";

export interface TeamStanding {
  teamId: string;
  name: string;
  color: string;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
}

export function computeStandings(
  matches: MatchView[],
  teamNameOf: (id: string | null) => string,
  teamColorOf: (id: string | null) => string
): TeamStanding[] {
  const map = new Map<string, TeamStanding>();

  for (const m of matches) {
    if (m.is_warmup) continue;
    const aId = m.team_a;
    const bId = m.team_b;
    if (!aId || !bId) continue;

    if (!map.has(aId)) {
      map.set(aId, {
        teamId: aId,
        name: teamNameOf(aId),
        color: teamColorOf(aId),
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }
    if (!map.has(bId)) {
      map.set(bId, {
        teamId: bId,
        name: teamNameOf(bId),
        color: teamColorOf(bId),
        wins: 0,
        losses: 0,
        draws: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      });
    }

    const a = map.get(aId)!;
    const b = map.get(bId)!;
    a.pointsFor += m.score_a;
    a.pointsAgainst += m.score_b;
    b.pointsFor += m.score_b;
    b.pointsAgainst += m.score_a;

    if (m.score_a > m.score_b) {
      a.wins++;
      b.losses++;
    } else if (m.score_b > m.score_a) {
      b.wins++;
      a.losses++;
    } else {
      a.draws++;
      b.draws++;
    }
  }

  return [...map.values()].sort((a, b) => {
    const winDiff = b.wins - a.wins;
    if (winDiff !== 0) return winDiff;
    const ptDiff = b.pointsFor - b.pointsAgainst - (a.pointsFor - a.pointsAgainst);
    if (ptDiff !== 0) return ptDiff;
    return b.pointsFor - a.pointsFor;
  });
}
