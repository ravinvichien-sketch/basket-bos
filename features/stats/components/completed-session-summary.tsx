import Image from "next/image";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatThaiDateTime } from "@/lib/format";
import { PlayerCardGenerator } from "./player-card-generator";

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
  minutes: number;
  fgm: number;
  fga: number;
  tpm: number;
  tpa: number;
  ftm: number;
  fta: number;
  is_mvp: boolean;
}

interface MatchRow {
  id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
}

interface CardGenRow {
  id: string;
  card_url: string | null;
  ai_image_url: string | null;
}

export async function CompletedSessionSummary({
  gameId,
  gameTitle,
  gameLocation,
  gameDate,
}: {
  gameId: string;
  gameTitle: string;
  gameLocation: string;
  gameDate: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: stats }, { data: cardGen }] = await Promise.all([
    supabase
      .from("player_game_stats")
      .select("profile_id, match_id, points, assists, reb_off, reb_def, steals, blocks, turnovers, fouls, minutes, fgm, fga, tpm, tpa, ftm, fta, is_mvp")
      .eq("game_id", gameId)
      .eq("profile_id", user.id),
    supabase
      .from("player_card_generations")
      .select("id, card_url, ai_image_url")
      .eq("game_id", gameId)
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  const { data: matches } = await supabase
    .from("matches")
    .select("id, team_a_name, team_b_name, score_a, score_b")
    .eq("game_id", gameId)
    .eq("status", "finished")
    .order("created_at");

  const myStats = (stats ?? []) as StatRow[];
  const finishedMatches = (matches ?? []) as MatchRow[];
  const myCard = cardGen as CardGenRow | null;

  const totals = {
    games: myStats.length, points: 0, assists: 0, reb_off: 0, reb_def: 0,
    steals: 0, blocks: 0, turnovers: 0, fouls: 0, minutes: 0,
    fgm: 0, fga: 0, tpm: 0, tpa: 0, ftm: 0, fta: 0, mvpCount: 0,
  };
  for (const s of myStats) {
    totals.points += s.points; totals.assists += s.assists;
    totals.reb_off += s.reb_off; totals.reb_def += s.reb_def;
    totals.steals += s.steals; totals.blocks += s.blocks;
    totals.turnovers += s.turnovers; totals.fouls += s.fouls;
    totals.minutes += s.minutes;
    totals.fgm += s.fgm; totals.fga += s.fga;
    totals.tpm += s.tpm; totals.tpa += s.tpa;
    totals.ftm += s.ftm; totals.fta += s.fta;
    if (s.is_mvp) totals.mvpCount += 1;
  }

  const fgPct = totals.fga > 0 ? Math.round((totals.fgm / totals.fga) * 100) : null;
  const tpPct = totals.tpa > 0 ? Math.round((totals.tpm / totals.tpa) * 100) : null;
  const ftPct = totals.fta > 0 ? Math.round((totals.ftm / totals.fta) * 100) : null;
  const ppg = totals.games > 0 ? (totals.points / totals.games).toFixed(1) : "0";
  const rpg = totals.games > 0 ? ((totals.reb_off + totals.reb_def) / totals.games).toFixed(1) : "0";
  const apg = totals.games > 0 ? (totals.assists / totals.games).toFixed(1) : "0";

  return (
    <div className="space-y-4">
      <Card>
        <CardTitle>🏆 สรุป Session</CardTitle>
        {myStats.length === 0 ? (
          <p className="text-sm text-ink-faint text-center py-4">
            คุณไม่มีสถิติใน Session นี้
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
                <p className="text-2xl font-black text-court tabular-nums">{totals.points}</p>
                <p className="text-[10px] text-ink-dim">คะแนน ({ppg}/G)</p>
              </div>
              <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
                <p className="text-2xl font-black text-amber-400 tabular-nums">{totals.assists}</p>
                <p className="text-[10px] text-ink-dim">แอสซิสต์ ({apg}/G)</p>
              </div>
              <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
                <p className="text-2xl font-black text-emerald-400 tabular-nums">{totals.reb_off + totals.reb_def}</p>
                <p className="text-[10px] text-ink-dim">รีบาวด์ ({rpg}/G)</p>
              </div>
              <div className="rounded-xl bg-surface-overlay/50 p-3 text-center">
                <p className="text-2xl font-black text-blue-400 tabular-nums">{totals.steals + totals.blocks}</p>
                <p className="text-[10px] text-ink-dim">สตีล+บล็อก</p>
              </div>
            </div>

            {/* Shooting % */}
            <div className="flex gap-2 text-xs">
              <div className="flex-1 rounded-lg bg-surface-overlay/30 p-2 text-center">
                <span className="font-bold">{fgPct !== null ? `${fgPct}%` : "-"}</span>
                <span className="text-ink-faint ml-1">2PT ({totals.fgm}/{totals.fga})</span>
              </div>
              <div className="flex-1 rounded-lg bg-surface-overlay/30 p-2 text-center">
                <span className="font-bold">{tpPct !== null ? `${tpPct}%` : "-"}</span>
                <span className="text-ink-faint ml-1">3PT ({totals.tpm}/{totals.tpa})</span>
              </div>
              <div className="flex-1 rounded-lg bg-surface-overlay/30 p-2 text-center">
                <span className="font-bold">{ftPct !== null ? `${ftPct}%` : "-"}</span>
                <span className="text-ink-faint ml-1">FT ({totals.ftm}/{totals.fta})</span>
              </div>
            </div>

            {/* Card & AI generator */}
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
              gameTitle={gameTitle}
              gameLocation={gameLocation}
              gameDate={formatThaiDateTime(gameDate)}
              existingCard={myCard}
              matches={finishedMatches}
              perMatchStats={myStats.map((s) => ({
                match_id: s.match_id,
                points: s.points, assists: s.assists,
                reb_off: s.reb_off, reb_def: s.reb_def,
                is_mvp: s.is_mvp, minutes: s.minutes,
              }))}
            />

            <Link
              href={`/games/${gameId}/summary`}
              className="block text-center text-xs text-ink-faint hover:text-court transition py-2"
            >
              ดูสรุปทั้ง Session →
            </Link>
          </div>
        )}
      </Card>
    </div>
  );
}
