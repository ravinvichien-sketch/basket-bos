import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import {
  PlayersAdmin,
  type AdminPlayer,
} from "@/features/groups/components/players-admin";
import { Card } from "@/components/ui/card";

export default async function PlayersAdminPage() {
  const { supabase, isAdmin } = await getAdminContext();
  if (!isAdmin) redirect("/dashboard");

  const [{ data: profiles }, { data: groups }, { data: gm }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, nickname, avatar_url")
      .eq("onboarded", true)
      .eq("is_guest", false)
      .order("nickname"),
    supabase
      .from("groups")
      .select("id, name")
      .is("deleted_at", null)
      .order("name"),
    supabase.from("group_members").select("group_id, profile_id"),
  ]);

  const byPlayer = new Map<string, string[]>();
  (gm ?? []).forEach((m) => {
    const arr = byPlayer.get(m.profile_id) ?? [];
    arr.push(m.group_id);
    byPlayer.set(m.profile_id, arr);
  });

  const players: AdminPlayer[] = (profiles ?? []).map((p) => ({
    id: p.id,
    nickname: p.nickname,
    avatarUrl: p.avatar_url,
    groupIds: byPlayer.get(p.id) ?? [],
  }));

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href="/groups" className="text-xs text-ink-faint">
          ← ก๊วน
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">จัดการผู้เล่น 👥</h1>
        <p className="text-sm text-ink-dim">
          ค้นหา, เลือกหลายคน, จัดก๊วนให้คนที่ยังไม่เลือก (เฉพาะแอดมินเต็มระบบ)
        </p>
      </header>

      {(groups ?? []).length === 0 ? (
        <Card className="py-8 text-center text-sm text-ink-faint">
          ยังไม่มีก๊วน — สร้างก๊วนก่อนที่หน้า “ก๊วน”
        </Card>
      ) : (
        <Card>
          <PlayersAdmin players={players} groups={groups ?? []} />
        </Card>
      )}
    </main>
  );
}
