import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { createGame } from "@/features/games/actions";
import { GameForm } from "@/features/games/components/game-form";
import { toBangkokInput } from "@/lib/format";

export default async function NewGamePage() {
  const { supabase, user, isAdmin } = await getAdminContext();

  // ก๊วนที่ผู้ใช้สร้างนัดได้: แอดมินเต็มระบบ = ทุกก๊วน / แอดมินก๊วน = เฉพาะก๊วนตัวเอง
  const { data: allGroups } = await supabase
    .from("groups")
    .select("id, name")
    .is("deleted_at", null)
    .order("name");

  let groups = allGroups ?? [];
  if (!isAdmin) {
    const { data: myAdminGroups } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", user.id)
      .eq("role", "admin");
    const adminGroupIds = new Set(
      (myAdminGroups ?? []).map((m) => m.group_id)
    );
    groups = groups.filter((g) => adminGroupIds.has(g.id));
  }

  // ไม่ใช่แอดมินของก๊วนไหนเลย → ไม่มีสิทธิ์สร้างนัด
  if (groups.length === 0) redirect("/games");

  // Sensible defaults: next occurrence at 19:00–21:00, deadline = start time
  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(19, 0, 0, 0);
  const end = new Date(start);
  end.setHours(21, 0, 0, 0);

  return (
    <main className="px-5 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold">สร้าง Session</h1>
      <GameForm
        action={createGame}
        groups={groups ?? []}
        submitLabel="สร้าง Session 🏀"
        showPublishToggle
        defaults={{
          starts_at: toBangkokInput(start.toISOString()),
          ends_at: toBangkokInput(end.toISOString()),
          reg_opens_at: toBangkokInput(new Date().toISOString()),
          reg_deadline: toBangkokInput(start.toISOString()),
        }}
      />
    </main>
  );
}
