import Link from "next/link";
import { getAdminContext } from "@/features/auth/guards";
import { CreateGroupForm } from "@/features/groups/components/create-group-form";
import { Card, CardTitle } from "@/components/ui/card";

export default async function GroupsPage() {
  const { supabase, user, isAdmin } = await getAdminContext();

  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded")
    .eq("id", user.id)
    .single();
  const isOnboarded = profile?.onboarded === true;

  const [{ data: groups }, { data: myMemberships }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name")
      .is("deleted_at", null)
      .order("created_at"),
    supabase
      .from("group_members")
      .select("group_id")
      .eq("profile_id", user.id),
  ]);

  const myGroupIds = new Set((myMemberships ?? []).map((m) => m.group_id));
  const groupList = isAdmin
    ? (groups ?? [])
    : (groups ?? []).filter((g) => myGroupIds.has(g.id));

  // Member counts — only for visible groups
  const memberCounts = new Map<string, number>();
  if (groupList.length > 0) {
    const { data: memberRows } = await supabase
      .from("group_members")
      .select("group_id")
      .in("group_id", groupList.map((g) => g.id));
    for (const m of memberRows ?? []) {
      memberCounts.set(
        m.group_id as string,
        (memberCounts.get(m.group_id as string) ?? 0) + 1
      );
    }
  }

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <h1 className="text-2xl font-extrabold">ก๊วน 🏀</h1>
        <p className="text-sm text-ink-dim">
          ก๊วนทั้งหมดในระบบ — แตะเพื่อดูสมาชิกและจัดการ
        </p>
      </header>

      {isAdmin && (
        <Link
          href="/admin/players"
          className="flex h-12 items-center justify-center gap-2 rounded-xl2 bg-surface-raised border border-white/5 text-sm font-semibold hover:border-court/40 transition"
        >
          👥 จัดการผู้เล่น (ค้นหา · จัดก๊วน · หลายคนพร้อมกัน)
        </Link>
      )}

      {isOnboarded && (
        <Card>
          <CardTitle>สร้างก๊วนใหม่</CardTitle>
          <p className="text-xs text-ink-faint mt-1">
            ต้องมี LINE Group ก่อน — ผู้ก่อตั้งจะเป็นแอดมินก๊วนโดยอัตโนมัติ
          </p>
          <div className="mt-3">
            <CreateGroupForm />
          </div>
        </Card>
      )}

      {groupList.length === 0 ? (
        <Card className="py-10 text-center text-sm text-ink-faint">
          {isAdmin
            ? "ยังไม่มีก๊วนในระบบ"
            : "คุณยังไม่ได้เป็นสมาชิกก๊วนไหน — ให้แอดมินก๊วนเพิ่มคุณเข้า LINE Group หรือสร้างก๊วนใหม่เลย"}
        </Card>
      ) : (
        <div className="space-y-3">
          {groupList.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="flex items-center justify-between hover:border-court/40 transition">
                <div>
                  <p className="font-bold">{g.name}</p>
                  <p className="text-xs text-ink-faint">
                    {memberCounts.get(g.id) ?? 0} สมาชิก
                  </p>
                </div>
                <span className="text-ink-faint">›</span>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
