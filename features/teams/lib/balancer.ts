/**
 * Fair team balancer.
 * 1. Composite score per player (skill 60% + height 25% + weight 15%, normalized)
 * 2. Snake draft by score (seeded jitter → "regenerate" gives fresh variations)
 * 3. Hill-climb swaps to minimize: variance of team strength + position imbalance
 *
 * Win-rate & attendance join the composite once match history exists (M6+)
 * — pass them in `extraScore` when available.
 */

export interface BalancerPlayer {
  id: string;
  skill: number; // 1–10
  height: number; // cm
  weight: number; // kg
  positions: string[]; // ordered by preference, e.g. ["PF","C"]
  extraScore?: number; // 0–1 normalized win-rate/attendance blend (optional)
}

export interface BalancedTeam {
  playerIds: string[];
  strength: number;
}

function mulberry32(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normalizer(values: number[]) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  return (v: number) => (range === 0 ? 0.5 : (v - min) / range);
}

function variance(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return (
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  );
}

/** Normalized composite score per player (same weights the auto-balancer uses). */
export function compositeScores(
  players: BalancerPlayer[]
): Map<string, number> {
  const normSkill = normalizer(players.map((p) => p.skill));
  const normHeight = normalizer(players.map((p) => p.height));
  const normWeight = normalizer(players.map((p) => p.weight));
  return new Map(
    players.map((p) => {
      const base =
        0.6 * normSkill(p.skill) +
        0.25 * normHeight(p.height) +
        0.15 * normWeight(p.weight);
      return [
        p.id,
        p.extraScore != null ? 0.8 * base + 0.2 * p.extraScore : base,
      ];
    })
  );
}

export function balanceTeams(
  players: BalancerPlayer[],
  numTeams: number,
  seed: number
): BalancedTeam[] {
  if (numTeams < 2) throw new Error("numTeams must be >= 2");
  if (players.length < numTeams) throw new Error("not enough players");

  const rng = mulberry32(seed);

  const normSkill = normalizer(players.map((p) => p.skill));
  const normHeight = normalizer(players.map((p) => p.height));
  const normWeight = normalizer(players.map((p) => p.weight));

  const scores = new Map<string, number>();
  for (const p of players) {
    const base =
      0.6 * normSkill(p.skill) +
      0.25 * normHeight(p.height) +
      0.15 * normWeight(p.weight);
    const withExtra =
      p.extraScore != null ? 0.8 * base + 0.2 * p.extraScore : base;
    scores.set(p.id, withExtra);
  }

  // Seeded jitter so each regenerate explores a different draft order
  const drafted = [...players].sort(
    (a, b) =>
      scores.get(b.id)! + (rng() - 0.5) * 0.1 -
      (scores.get(a.id)! + (rng() - 0.5) * 0.1)
  );

  // Snake draft
  const teams: BalancerPlayer[][] = Array.from({ length: numTeams }, () => []);
  let idx = 0;
  let dir = 1;
  for (const p of drafted) {
    teams[idx].push(p);
    if (idx + dir === numTeams || idx + dir === -1) dir = -dir;
    else idx += dir;
  }

  const primaryPos = (p: BalancerPlayer) => p.positions[0] ?? "SF";

  const objective = (ts: BalancerPlayer[][]): number => {
    const strengths = ts.map((t) =>
      t.reduce((s, p) => s + scores.get(p.id)!, 0)
    );
    let posPenalty = 0;
    for (const pos of ["PG", "SG", "SF", "PF", "C"]) {
      const counts = ts.map(
        (t) => t.filter((p) => primaryPos(p) === pos).length
      );
      posPenalty += variance(counts);
    }
    // Size fairness matters too when player count isn't divisible
    const sizes = ts.map((t) => t.length);
    return variance(strengths) + 0.05 * posPenalty + 0.5 * variance(sizes);
  };

  // Hill-climb: random cross-team swaps, keep improvements
  let best = objective(teams);
  const iterations = Math.min(800, players.length * 60);
  for (let i = 0; i < iterations; i++) {
    const a = Math.floor(rng() * numTeams);
    let b = Math.floor(rng() * numTeams);
    if (a === b) b = (b + 1) % numTeams;
    if (teams[a].length === 0 || teams[b].length === 0) continue;
    const ai = Math.floor(rng() * teams[a].length);
    const bi = Math.floor(rng() * teams[b].length);

    [teams[a][ai], teams[b][bi]] = [teams[b][bi], teams[a][ai]];
    const next = objective(teams);
    if (next < best) {
      best = next;
    } else {
      [teams[a][ai], teams[b][bi]] = [teams[b][bi], teams[a][ai]]; // revert
    }
  }

  return teams.map((t) => ({
    playerIds: t.map((p) => p.id),
    strength: t.reduce((s, p) => s + scores.get(p.id)!, 0),
  }));
}
