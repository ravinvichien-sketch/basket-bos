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

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase
      .from("groups")
      .select("id, name")
      .is("deleted_at", null)
      .order("created_at"),
    supabase.from("group_members").select("group_id, profile_id"),
  ]);

  const groupList = groups ?? [];
  const countOf = (gid: string) =>
    (members ?? []).filter((m) => m.group_id === gid).length;

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
          ยังไม่มีก๊วน{isOnboarded ? " — สร้างก๊วนแรกด้านบน" : ""}
        </Card>
      ) : (
        <div className="space-y-3">
          {groupList.map((g) => (
            <Link key={g.id} href={`/groups/${g.id}`}>
              <Card className="flex items-center justify-between hover:border-court/40 transition">
                <div>
                  <p className="font-bold">{g.name}</p>
                  <p className="text-xs text-ink-faint">
                    {countOf(g.id)} สมาชิก
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
