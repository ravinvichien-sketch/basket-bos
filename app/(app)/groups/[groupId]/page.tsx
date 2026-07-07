import Link from "next/link";
import { notFound } from "next/navigation";
import { getAdminContext } from "@/features/auth/guards";
import {
  GroupManager,
  type GroupMemberView,
} from "@/features/groups/components/group-manager";
import { GroupLocationEditor } from "@/features/groups/components/group-location-editor";
import { Card, CardTitle } from "@/components/ui/card";
import { formatThaiDateTime } from "@/lib/format";

interface MemberRow {
  profile_id: string;
  role: "admin" | "player";
  profiles: { nickname: string; avatar_url: string | null } | null;
}

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  const { supabase, user, isAdmin } = await getAdminContext();

  const [{ data: group }, { data: memberRows }, { data: allProfiles }, { data: games }, { data: myJoinReq }] =
    await Promise.all([
      supabase
        .from("groups")
        .select("id, name, location, lat, lng, deleted_at")
        .eq("id", groupId)
        .single(),
      supabase
        .from("group_members")
        .select("profile_id, role, profiles!profile_id(nickname, avatar_url)")
        .eq("group_id", groupId),
      supabase
        .from("profiles")
        .select("id, nickname")
        .eq("onboarded", true)
        .eq("is_guest", false)
        .order("nickname"),
      supabase
        .from("games")
        .select("id, title, starts_at, status")
        .eq("group_id", groupId)
        .is("deleted_at", null)
        .order("starts_at", { ascending: false })
        .limit(10),
      supabase
        .from("group_join_requests")
        .select("id, status")
        .eq("group_id", groupId)
        .eq("requester_id", user.id)
        .maybeSingle(),
    ]);

  if (!group || group.deleted_at) notFound();

  const rows = (memberRows ?? []) as unknown as MemberRow[];
  const iAmGroupAdmin = rows.some(
    (r) => r.profile_id === user.id && r.role === "admin"
  );
  const canManage = isAdmin || iAmGroupAdmin;
  const iAmMember = rows.some((r) => r.profile_id === user.id);

  const members: GroupMemberView[] = rows
    .map((r) => ({
      id: r.profile_id,
      nickname: r.profiles?.nickname ?? "ผู้เล่น",
      avatarUrl: r.profiles?.avatar_url ?? null,
      role: r.role,
    }))
    .sort((a, b) =>
      a.role === b.role ? a.nickname.localeCompare(b.nickname) : a.role === "admin" ? -1 : 1
    );

  const memberIds = new Set(members.map((m) => m.id));
  const candidates = (allProfiles ?? []).filter((p) => !memberIds.has(p.id));

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href="/groups" className="text-xs text-ink-faint">
          ← ก๊วนทั้งหมด
        </Link>
        <h1 className="text-2xl font-extrabold mt-1">{group.name}</h1>
        <p className="text-sm text-ink-dim">{members.length} สมาชิก</p>
      </header>

      <Card>
        <CardTitle>📍 สถานที่</CardTitle>
        <div className="mt-2">
          <GroupLocationEditor
            groupId={groupId}
            currentLocation={group.location}
            currentLat={group.lat}
            currentLng={group.lng}
            canManage={canManage}
          />
        </div>
      </Card>

      {!iAmMember && (
        <Card>
          <CardTitle>📩 ขอเข้าก๊วน</CardTitle>
          <div className="mt-2">
            <JoinRequestButton
              groupId={groupId}
              existingRequest={myJoinReq as { id: string; status: string } | null}
            />
          </div>
        </Card>
      )}

      <Card>
        <CardTitle>สมาชิก</CardTitle>
        <div className="mt-2">
          <GroupManager
            groupId={groupId}
            groupName={group.name}
            isSuperAdmin={isAdmin}
            canManage={canManage}
            members={members}
            candidates={candidates}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <CardTitle>เกมของก๊วนนี้</CardTitle>
          {isAdmin && (
            <Link
              href="/games/new"
              className="rounded-lg bg-court px-3 py-1.5 text-xs font-semibold text-white hover:bg-court-dark transition"
            >
              + สร้างเกม
            </Link>
          )}
        </div>
        {games && games.length > 0 ? (
          <ul className="mt-2 divide-y divide-white/5">
            {games.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/games/${g.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:text-court transition"
                >
                  <span className="truncate">{g.title}</span>
                  <span className="text-xs text-ink-faint shrink-0 ml-2">
                    {formatThaiDateTime(g.starts_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 py-4 text-center text-sm text-ink-faint">
            ยังไม่มีเกมของก๊วนนี้
          </p>
        )}
      </Card>
    </main>
  );
}

import { JoinRequestButton } from "./join-request-button";
