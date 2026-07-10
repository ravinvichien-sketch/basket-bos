import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameEditorContext } from "@/features/auth/guards";
import { setTeamsLock, fillRemainingTeams } from "@/features/teams/actions";
import { AdminAddForm } from "@/features/registration/components/admin-add-form";
import { GenerateForm } from "@/features/teams/components/generate-form";
import {
  TeamsBoard,
  type TeamView,
  type TeamMemberView,
} from "@/features/teams/components/teams-board";
import { Card } from "@/components/ui/card";

interface ProfileLite {
  nickname: string;
  avatar_url: string | null;
  height_cm: number | null;
  skill_rating: number;
}

export default async function TeamsPage({
  params,
}: {
  params: Promise<{ gameId: string }>;
}) {
  const { gameId } = await params;
  const { supabase, canManage } = await getGameEditorContext(gameId);

  const [{ data: game }, { data: teamsData }, { data: confirmedRegs }] =
    await Promise.all([
      supabase.from("games").select("id, title, group_id").eq("id", gameId).single(),
      supabase
        .from("teams")
        .select(
          "id, name, color, locked, team_members(profile_id, assigned_position, profiles(nickname, avatar_url, height_cm, skill_rating))"
        )
        .eq("game_id", gameId)
        .order("name"),
      supabase
        .from("registrations")
        .select(
          "profile_id, profiles!profile_id(nickname, avatar_url, height_cm, skill_rating)"
        )
        .eq("game_id", gameId)
        .eq("status", "confirmed")
        .order("registered_at"),
    ]);
  if (!game) notFound();

  // Candidates for admin-add: group members not yet registered
  let candidates: { id: string; nickname: string }[] = [];
  if (game.group_id) {
    const { data: gmRows } = await supabase
      .from("group_members")
      .select("profile_id")
      .eq("group_id", game.group_id);
    const memberIds = new Set((gmRows ?? []).map((r) => r.profile_id));
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id, nickname")
      .eq("onboarded", true)
      .order("nickname");
    const registeredIds = new Set((confirmedRegs ?? []).map((r) => r.profile_id));
    candidates = (allProfiles ?? [])
      .filter((p) => memberIds.has(p.id) && !registeredIds.has(p.id))
      .map((p) => ({ id: p.id, nickname: p.nickname }));
  }
  if (!game) notFound();

  const teams: TeamView[] = (teamsData ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    members: (
      (t.team_members ?? []) as unknown as {
        profile_id: string;
        assigned_position: string | null;
        profiles: ProfileLite | null;
      }[]
    ).map((m) => ({
      profileId: m.profile_id,
      nickname: m.profiles?.nickname ?? "ผู้เล่น",
      avatarUrl: m.profiles?.avatar_url ?? null,
      position: m.assigned_position,
      heightCm: m.profiles?.height_cm ?? null,
      skill: Number(m.profiles?.skill_rating ?? 5),
    })),
  }));

  const assignedIds = new Set(
    teams.flatMap((t) => t.members.map((m) => m.profileId))
  );
  const unassigned: TeamMemberView[] = (confirmedRegs ?? [])
    .filter((r) => !assignedIds.has(r.profile_id))
    .map((r) => {
      const prof = r.profiles as unknown as ProfileLite | null;
      return {
        profileId: r.profile_id,
        nickname: prof?.nickname ?? "ผู้เล่น",
        avatarUrl: prof?.avatar_url ?? null,
        position: null,
        heightCm: prof?.height_cm ?? null,
        skill: Number(prof?.skill_rating ?? 5),
      };
    });

  const locked = (teamsData ?? []).some((t) => t.locked);
  const hasTeams = teams.length > 0;

  return (
    <main className="px-5 py-8 space-y-5">
      <header>
        <Link href={`/games/${gameId}`} className="text-xs text-ink-faint">
          ← กลับหน้า Session
        </Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="text-2xl font-extrabold">จัดทีม ⚖️</h1>
          {locked && (
            <span className="rounded-full bg-amber-500/15 text-amber-400 px-3 py-1 text-xs font-semibold">
              🔒 ล็อคแล้ว
            </span>
          )}
        </div>
        <p className="text-sm text-ink-dim">{game.title}</p>
      </header>

      {canManage && (
        <GenerateForm gameId={gameId} hasTeams={hasTeams} locked={locked} />
      )}

      {canManage && hasTeams && !locked && unassigned.length > 0 && (
        <form action={fillRemainingTeams.bind(null, gameId)}>
          <button
            type="submit"
            className="w-full h-11 rounded-xl bg-court/15 text-court text-sm font-bold hover:bg-court/25 transition"
          >
            🎲 สุ่มเฉพาะ {unassigned.length} คนที่ยังไม่มีทีม
          </button>
        </form>
      )}

      {canManage && candidates.length > 0 && !locked && (
        <Card>
          <div className="text-sm font-semibold mb-2">เพิ่มผู้เล่นอื่นที่ยังไม่ลงทะเบียน</div>
          <AdminAddForm gameId={gameId} candidates={candidates} />
        </Card>
      )}

      {hasTeams ? (
        <>
          <TeamsBoard
            gameId={gameId}
            teams={teams}
            unassigned={unassigned}
            isAdmin={canManage}
            locked={locked}
          />
          {canManage && (
            <form action={setTeamsLock.bind(null, gameId, !locked)}>
              <button
                type="submit"
                className="w-full h-11 rounded-xl bg-surface-overlay text-sm font-semibold hover:bg-surface-overlay/70 transition"
              >
                {locked ? "🔓 ปลดล็อคทีม" : "🔒 ล็อคทีม (ยืนยันตัวจริง)"}
              </button>
            </form>
          )}
        </>
      ) : (
        <Card className="py-12 text-center text-sm text-ink-faint">
          {canManage
            ? "เลือก: จัดอัตโนมัติทั้งหมด หรือสร้างทีมว่างแล้วจัดเองทีละคน (ที่เหลือกดสุ่มได้)"
            : "แอดมินยังไม่จัดทีมสำหรับเกมนี้"}
        </Card>
      )}
    </main>
  );
}
