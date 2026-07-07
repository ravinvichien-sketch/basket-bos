import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { MatchVideoForm } from "@/features/videos/components/match-video-form";
import { youtubeEmbed } from "@/features/videos/lib/youtube";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MatchRow {
  id: string;
  team_a_name: string | null;
  team_b_name: string | null;
  score_a: number;
  score_b: number;
  is_warmup: boolean;
  video_url: string | null;
}

export default async function VideosPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase } = await getAdminContext();

  const [{ data: game }, { data: matchesData }] = await Promise.all([
    supabase.from("games").select("id, title").eq("id", gameId).single(),
    supabase
      .from("matches")
      .select(
        "id, team_a_name, team_b_name, score_a, score_b, is_warmup, video_url"
      )
      .eq("game_id", gameId)
      .order("created_at"),
  ]);
  if (!game) notFound();

  const matches = (matchesData ?? []) as MatchRow[];

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">ดูย้อนหลัง 🎬</h1>
        <p className="text-sm text-ink-dim">
          {game.title} — แปะลิงก์ YouTube ของแต่ละเกมส์ไว้ดูย้อนหลัง
        </p>
      </header>

      {matches.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-faint space-y-3">
          <p>ยังไม่มีเกมส์ใน Session นี้</p>
          <Link
            href={`/games/${gameId}/stats`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-surface-overlay px-4 text-sm font-semibold text-ink hover:bg-surface-overlay/70 transition"
          >
            ไปบันทึกผลแข่งก่อน →
          </Link>
        </Card>
      ) : (
        matches.map((m, i) => {
          const embed = youtubeEmbed(m.video_url);
          const aWins = m.score_a > m.score_b;
          const bWins = m.score_b > m.score_a;
          return (
            <Card key={m.id} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-ink-faint tabular-nums">
                  เกมส์ที่ {i + 1}
                </span>
                {m.is_warmup && (
                  <span className="rounded-full bg-amber-500/15 text-amber-400 px-2 py-0.5 text-[10px] font-semibold">
                    วอร์มอัพ
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn("flex-1 text-right truncate", aWins && "font-bold")}
                >
                  {aWins && "🏆 "}
                  {m.team_a_name ?? "ทีม A"}
                </span>
                <span className="shrink-0 rounded-lg bg-surface-overlay px-3 py-1 font-black tabular-nums">
                  {m.score_a} - {m.score_b}
                </span>
                <span className={cn("flex-1 truncate", bWins && "font-bold")}>
                  {m.team_b_name ?? "ทีม B"}
                  {bWins && " 🏆"}
                </span>
              </div>

              {embed && (
                <div
                  className="relative w-full overflow-hidden rounded-xl bg-black"
                  style={{ aspectRatio: "16 / 9" }}
                >
                  <iframe
                    src={embed}
                    title={`เกมส์ ${i + 1}`}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 h-full w-full"
                  />
                </div>
              )}

              <MatchVideoForm
                matchId={m.id}
                gameId={gameId}
                initialUrl={m.video_url}
              />
            </Card>
          );
        })
      )}
    </main>
  );
}
