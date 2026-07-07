import { notFound, redirect } from "next/navigation";
import { getGameEditorContext } from "@/features/auth/guards";
import { updateGame } from "@/features/games/actions";
import { GameForm } from "@/features/games/components/game-form";
import { toBangkokInput } from "@/lib/format";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, user, isAdmin, canManage } =
    await getGameEditorContext(gameId);
  if (!canManage) redirect(`/games/${gameId}`);

  const [{ data: game }, { data: allGroups }] = await Promise.all([
    supabase.from("games").select("*").eq("id", gameId).single(),
    supabase
      .from("groups")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
  ]);
  if (!game) notFound();

  // แอดมินก๊วนย้ายนัดได้เฉพาะไปก๊วนที่ตัวเองดูแล
  let groups = allGroups ?? [];
  if (!isAdmin) {
    const { data: myAdminGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", user.id)
      .eq("role", "admin");
    const ids = new Set((myAdminGroups ?? []).map((m) => m.group_id));
    groups = groups.filter((g) => ids.has(g.id));
  }

  const boundUpdate = updateGame.bind(null, gameId);

  return (
    <main className="px-5 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold">แก้ไขเกม</h1>
      <GameForm
        action={boundUpdate}
        groups={groups ?? []}
        submitLabel="บันทึกการแก้ไข"
        defaults={{
          group_id: game.group_id ?? undefined,
          title: game.title,
          location: game.location,
          starts_at: toBangkokInput(game.starts_at),
          ends_at: toBangkokInput(game.ends_at),
          reg_opens_at: toBangkokInput(game.reg_opens_at),
          reg_deadline: toBangkokInput(game.reg_deadline),
          fee_mode: game.fee_mode ?? "split",
          court_fee_thb: game.court_fee_thb,
          max_players: game.max_players,
          max_waitlist: game.max_waitlist ?? 5,
          notes: game.notes ?? undefined,
        }}
      />
    </main>
  );
}
