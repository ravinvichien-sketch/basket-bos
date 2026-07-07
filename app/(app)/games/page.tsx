import Link from "next/link";
import { getAdminContext } from "@/features/auth/guards";
import { GameCard } from "@/features/games/components/game-card";
import { Card } from "@/components/ui/card";
import type { Game } from "@/types/database";

export default async function GamesPage() {
  const { supabase, user, isAdmin } = await getAdminContext();
  const nowIso = new Date().toISOString();

  // สร้างนัดได้ถ้าเป็นแอดมินเต็มระบบ หรือเป็นแอดมินของก๊วนใดก๊วนหนึ่ง
  let canCreate = isAdmin;
  if (!isAdmin) {
    const { count } = await supabase
      .from("group_members")
      .select("group_id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .eq("role", "admin");
    canCreate = (count ?? 0) > 0;
  }

  const [{ data: upcoming }, { data: past }] = await Promise.all([
    supabase
      .from("games")
      .select("*")
      .gte("ends_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: true }),
    supabase
      .from("games")
      .select("*")
      .lt("ends_at", nowIso)
      .neq("status", "cancelled")
      .order("starts_at", { ascending: false })
      .limit(10),
  ]);

  const allIds = [...(upcoming ?? []), ...(past ?? [])].map((g) => g.id);
  const counts = new Map<string, number>();
  if (allIds.length > 0) {
    const { data: countRows } = await supabase
      .from("v_game_counts")
      .select("game_id, confirmed_count")
      .in("game_id", allIds);
    countRows?.forEach((r) =>
      counts.set(r.game_id as string, Number(r.confirmed_count))
    );
  }

  return (
    <main className="px-5 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Session 🏀</h1>
        {canCreate && (
          <Link
            href="/games/new"
            className="rounded-xl bg-court px-4 py-2 text-sm font-semibold text-white hover:bg-court-dark transition"
          >
            + สร้าง Session
          </Link>
        )}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink-dim">กำลังจะมาถึง</h2>
        {upcoming && upcoming.length > 0 ? (
          upcoming.map((game) => (
            <GameCard
              key={game.id}
              game={game as Game}
              confirmedCount={counts.get(game.id)}
            />
          ))
        ) : (
          <Card className="py-10 text-center text-ink-faint text-sm">
            ยังไม่มี Session
            {canCreate && (
              <>
                <br />
                กด &ldquo;+ สร้าง Session&rdquo; เพื่อเปิดนัดแรกของก๊วน 🏀
              </>
            )}
          </Card>
        )}
      </section>

      {past && past.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink-dim">ที่ผ่านมา</h2>
          {past.map((game) => (
            <GameCard
              key={game.id}
              game={game as Game}
              confirmedCount={counts.get(game.id)}
            />
          ))}
        </section>
      )}
    </main>
  );
}
