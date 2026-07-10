import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import { createGame } from "@/features/games/actions";
import { GameForm } from "@/features/games/components/game-form";
import { toBangkokInput } from "@/lib/format";

export default async function NewGamePage() {
  const { supabase, user, isAdmin } = await getAdminContext();
  const { data: myAdminGroups } = await supabase
    .from("group_members")
    .select("group_id, role, groups!group_id(id, name, play_start_time, play_end_time)")
    .eq("profile_id", user.id);

  const groupMap = new Map<string, { id: string; name: string; play_start_time: string | null; play_end_time: string | null }>();
  for (const row of myAdminGroups ?? []) {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups;
    if (g && typeof g === "object" && "id" in g && "name" in g) {
      groupMap.set(g.id as string, g as { id: string; name: string; play_start_time: string | null; play_end_time: string | null });
    }
  }

  // ถ้าเป็น super admin → เห็นทุกก๊วน; ถ้าเป็น group admin → เห็นเฉพาะก๊วนที่ admin
  let groups: { id: string; name: string; play_start_time: string | null; play_end_time: string | null }[] = [];
  if (isAdmin) {
    const { data: allGroups } = await supabase
      .from("groups")
      .select("id, name, play_start_time, play_end_time")
      .is("deleted_at", null)
      .order("name");
    groups = (allGroups ?? []) as typeof groups;
  } else {
    const adminGroupIds = new Set(
      (myAdminGroups ?? []).filter((r) => r.role === "admin").map((r) => r.group_id)
    );
    groups = Array.from(groupMap.values()).filter((g) => adminGroupIds.has(g.id));
  }

  // ไม่ใช่แอดมินของก๊วนไหนเลย → ไม่มีสิทธิ์สร้างนัด
  if (groups.length === 0) redirect("/games");

  // หาเวลาประจำของก๊วนแรก (default)
  const g = groups[0] as { id: string; name: string; play_start_time: string | null; play_end_time: string | null } | undefined;
  const defaultStartHour = parseInt(g?.play_start_time?.slice(0, 2) ?? "19", 10);
  const defaultStartMin = parseInt(g?.play_start_time?.slice(3, 5) ?? "0", 10);
  const defaultEndHour = parseInt(g?.play_end_time?.slice(0, 2) ?? "21", 10);
  const defaultEndMin = parseInt(g?.play_end_time?.slice(3, 5) ?? "0", 10);

  const start = new Date();
  start.setDate(start.getDate() + 2);
  start.setHours(defaultStartHour, defaultStartMin, 0, 0);
  const end = new Date();
  end.setDate(end.getDate() + 2);
  end.setHours(defaultEndHour, defaultEndMin, 0, 0);

  return (
    <main className="px-5 py-8 space-y-6">
      <h1 className="text-2xl font-extrabold">สร้าง Session</h1>
      <GameForm
        action={createGame}
        groups={groups ?? []}
        submitLabel="สร้าง Session 🏀"
        defaults={{
          starts_at: toBangkokInput(start.toISOString()),
          ends_at: toBangkokInput(end.toISOString()),
        }}
      />
    </main>
  );
}
