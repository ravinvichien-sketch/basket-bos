/**
 * NBA Game Score formula — ใช้ประเมินประสิทธิภาพผู้เล่นในแต่ละเกมส์
 * Game Score = PTS + 0.4*FG - 0.7*FGA - 0.4*(FTA-FTM) + 0.7*OREB
 *              + 0.3*DREB + STL + 0.7*AST + 0.7*BLK - 0.4*PF - TOV
 * 
 * rating 0 = average performance
 * rating 10+ = great game
 * rating 40+ = legendary game
 */
export function computeGameScore(stats: {
  points: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  oreb: number;
  dreb: number;
  ast: number;
  stl: number;
  blk: number;
  tov: number;
  pf: number;
}): number {
  return +(
    stats.points +
    0.4 * stats.fgm -
    0.7 * stats.fga -
    0.4 * (stats.fta - stats.ftm) +
    0.7 * stats.oreb +
    0.3 * stats.dreb +
    stats.stl +
    0.7 * stats.ast +
    0.7 * stats.blk -
    0.4 * stats.pf -
    stats.tov
  ).toFixed(1);
}

/**
 * หา MVP ของ match (คนที่มี Game Score สูงสุด)
 */
export function findMVP(
  playerStats: { profile_id: string; gameScore: number }[]
): string | null {
  if (playerStats.length === 0) return null;
  const sorted = [...playerStats].sort((a, b) => b.gameScore - a.gameScore);
  return sorted[0].gameScore > 0 ? sorted[0].profile_id : null;
}