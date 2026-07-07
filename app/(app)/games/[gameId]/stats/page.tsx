import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import {
  StatEntry,
  type StatLine,
  type StatPlayer,
} from "@/features/stats/components/stat-entry";
import {
  MatchSection,
  type TeamOption,
  type MatchView,
} from "@/features/stats/components/match-section";
import {
  SessionLeaders,
  type LeaderStatRow,
} from "@/features/stats/components/session-leaders";
import { computeStandings, type TeamStanding } from "@/features/stats/lib/standings";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default async function GameStatsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, isAdmin } = await getAdminContext();

  const [
    { data: game },
    { data: regs },
    { data: existing },
    { data: teams },
    { data: matches },
  ] = await Promise.all([
    supabase
      .from("games")
      .select("id, title, status")
      .eq("id", gameId)
      .single(),
    supabase
      .from("registrations")
      .select("profile_id, profiles!profile_id(nickname, avatar_url)")
      .eq("game_id", gameId)
      .eq("status", "confirmed")
      .order("registered_at"),
    supabase.from("player_game_stats").select("*").eq("game_id", gameId),
    supabase
      .from("teams")
      .select("id, name, color")
      .eq("game_id", gameId)
      .order("name"),
    supabase
      .from("matches")
      .select(
        "id, team_a, team_b, team_a_name, team_b_name, score_a, score_b, is_warmup"
      )
      .eq("game_id", gameId)
      .order("created_at"),
  ]);
  if (!game) notFound();

  const players: StatPlayer[] = (regs ?? []).map((r) => {
    const prof = r.profiles as unknown as {
      nickname: string;
      avatar_url: string | null;
    } | null;
    return {
      profileId: r.profile_id,
      nickname: prof?.nickname ?? "ผู้เล่น",
      avatarUrl: prof?.avatar_url ?? null,
    };
  });

  const initial: Record<string, StatLine> = {};
  for (const s of existing ?? []) {
    initial[s.profile_id] = {
      minutes: s.minutes,
      fgm: s.fgm,
      fga: s.fga,
      tpm: s.tpm,
      tpa: s.tpa,
      ftm: s.ftm,
      fta: s.fta,
      assists: s.assists,
      reb_off: s.reb_off,
      reb_def: s.reb_def,
      steals: s.steals,
      blocks: s.blocks,
      turnovers: s.turnovers,
      fouls: s.fouls,
      is_mvp: s.is_mvp,
    };
  }

  const leaderRows: LeaderStatRow[] = (existing ?? []).map((s) => ({
    profile_id: s.profile_id,
    points: s.points,
    reb_off: s.reb_off,
    reb_def: s.reb_def,
    assists: s.assists,
    steals: s.steals,
    blocks: s.blocks,
  }));
  const hasStats = leaderRows.some(
    (r) => r.points + r.reb_off + r.reb_def + r.assists + r.steals + r.blocks > 0
  );

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">สถิติ 📊</h1>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href={`/games/${gameId}/live`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-court font-bold text-sm text-white hover:bg-court-dark transition"
        >
          🔴 จดสกอร์สด
        </Link>
        <Link
          href={`/games/${gameId}/summary`}
          className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 font-semibold text-sm hover:border-court/40 transition"
        >
          📊 สรุป Session
        </Link>
      </div>

      {hasStats && (
        <Card>
          <CardTitle>ผู้เล่นเด่นของนัดนี้ 🏅</CardTitle>
          <div className="mt-3">
            <SessionLeaders rows={leaderRows} players={players} />
          </div>
        </Card>
      )}

      <MatchSection
        gameId={gameId}
        teams={(teams ?? []) as TeamOption[]}
        matches={(matches ?? []) as MatchView[]}
        isAdmin={isAdmin}
      />

      {matches && matches.length > 0 && (
        <Card>
          <CardTitle>🏆 อันดับทีมประจำวัน</CardTitle>
          <div className="mt-3 space-y-1">
            {(
              computeStandings(
                matches as MatchView[],
                (id) => {
                  const t = (teams ?? []).find((t) => t.id === id);
                  return t?.name ?? "ทีม";
                },
                (id) => {
                  const t = (teams ?? []).find((t) => t.id === id);
                  return t?.color ?? "#94a3b8";
                }
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
                  <span className={cn(s.wins > 0 && "text-emerald-400 font-bold")}>
                    {s.wins}W
                  </span>
                  {" / "}
                  <span className={cn(s.losses > 0 && "text-red-400 font-bold")}>
                    {s.losses}L
                  </span>
                  {s.draws > 0 && (
                    <span className="text-ink-faint"> / {s.draws}D</span>
                  )}
                </span>
                <span className="text-xs tabular-nums text-ink-dim">
                  PF <b>{s.pointsFor}</b> · PA <b>{s.pointsAgainst}</b>
                </span>
                <span className="text-xs font-bold tabular-nums text-ink">
                  {s.pointsFor - s.pointsAgainst > 0 ? "+" : ""}
                  {s.pointsFor - s.pointsAgainst}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {players.length > 0 ? (
        <>
          <p className="text-xs text-ink-faint text-center">
            ทุกคนในก๊วนช่วยกันกดบันทึกได้เลย — เลือกผู้เล่นแล้วแตะปุ่มตามเหตุการณ์
          </p>
          <StatEntry gameId={gameId} players={players} initial={initial} />
        </>
      ) : (
        <Card className="py-12 text-center text-sm text-ink-faint">
          ยังไม่มีผู้เล่นตัวจริงในเกมนี้
        </Card>
      )}
    </main>
  );
}
