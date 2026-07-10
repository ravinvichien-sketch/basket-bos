"use server";

import { revalidatePath } from "next/cache";
import { getGameEditorContext } from "@/features/auth/guards";
import { pushToProfiles } from "@/features/notifications/line";
import {
  balanceTeams,
  compositeScores,
  type BalancerPlayer,
} from "./lib/balancer";

export interface ActionState {
  error?: string;
}

const TEAM_PRESETS = [
  { name: "ทีมส้ม", color: "#F97316" },
  { name: "ทีมขาว", color: "#E2E8F0" },
  { name: "ทีมดำ", color: "#334155" },
  { name: "ทีมฟ้า", color: "#38BDF8" },
];

function revalidateTeams(gameId: string) {
  revalidatePath(`/games/${gameId}/teams`);
  revalidatePath(`/games/${gameId}`);
  revalidatePath(`/games/${gameId}/live`);
}

export async function generateTeams(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const numTeams = Math.min(4, Math.max(2, Number(formData.get("num_teams") ?? 2)));

  const { data: locked } = await supabase
    .from("teams")
    .select("id")
    .eq("game_id", gameId)
    .eq("locked", true)
    .limit(1);
  if (locked && locked.length > 0) {
    return { error: "ทีมถูกล็อคอยู่ — ปลดล็อคก่อนสุ่มใหม่" };
  }

  const { data: regs } = await supabase
    .from("registrations")
    .select(
      "profile_id, profiles!profile_id(id, skill_rating, height_cm, weight_kg, player_positions(position, priority))"
    )
    .eq("game_id", gameId)
    .eq("status", "confirmed");

  if (!regs || regs.length < numTeams * 2) {
    return { error: `ต้องมีผู้เล่นอย่างน้อย ${numTeams * 2} คน` };
  }

  const players: BalancerPlayer[] = regs.map((r) => {
    const prof = r.profiles as unknown as {
      id: string;
      skill_rating: number;
      height_cm: number | null;
      weight_kg: number | null;
      player_positions: { position: string; priority: number }[];
    };
    return {
      id: prof.id,
      skill: Number(prof.skill_rating ?? 5),
      height: prof.height_cm ?? 175,
      weight: prof.weight_kg ?? 70,
      positions: (prof.player_positions ?? [])
        .sort((a, b) => a.priority - b.priority)
        .map((p) => p.position),
    };
  });

  const seed = Math.floor(Math.random() * 2 ** 31);
  const result = balanceTeams(players, numTeams, seed);

  // Replace previous teams (cascade removes members)
  await supabase.from("teams").delete().eq("game_id", gameId);

  const { data: newTeams, error: teamError } = await supabase
    .from("teams")
    .insert(
      result.map((_, i) => ({
        game_id: gameId,
        name: TEAM_PRESETS[i].name,
        color: TEAM_PRESETS[i].color,
        seed,
      }))
    )
    .select("id");
  if (teamError || !newTeams) return { error: "สร้างทีมไม่สำเร็จ" };

  const posOf = new Map(players.map((p) => [p.id, p.positions[0] ?? null]));
  const members = result.flatMap((team, i) =>
    team.playerIds.map((pid) => ({
      team_id: newTeams[i].id,
      profile_id: pid,
      assigned_position: posOf.get(pid),
    }))
  );
  const { error: memberError } = await supabase
    .from("team_members")
    .insert(members);
  if (memberError) return { error: "บันทึกสมาชิกทีมไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}

/** สร้างทีมว่างสำหรับจัดเอง (ลบทีมเดิมที่ยังไม่ล็อคทิ้ง) */
export async function createEmptyTeams(
  gameId: string,
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const numTeams = Math.min(
    4,
    Math.max(2, Number(formData.get("num_teams") ?? 4))
  );

  const { data: locked } = await supabase
    .from("teams")
    .select("id")
    .eq("game_id", gameId)
    .eq("locked", true)
    .limit(1);
  if (locked && locked.length > 0) {
    return { error: "ทีมถูกล็อคอยู่ — ปลดล็อคก่อน" };
  }

  await supabase.from("teams").delete().eq("game_id", gameId);
  const { error } = await supabase.from("teams").insert(
    TEAM_PRESETS.slice(0, numTeams).map((t) => ({
      game_id: gameId,
      name: t.name,
      color: t.color,
    }))
  );
  if (error) return { error: "สร้างทีมไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}

/** ย้าย/ใส่ผู้เล่นเข้าทีมที่เลือก (โหมดจัดเอง) */
export async function assignPlayerToTeam(
  gameId: string,
  profileId: string,
  teamId: string
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const { data: teams } = await supabase
    .from("teams")
    .select("id, locked")
    .eq("game_id", gameId);
  if (!teams?.some((t) => t.id === teamId)) return { error: "ไม่พบทีม" };
  if (teams.some((t) => t.locked)) return { error: "ทีมถูกล็อคอยู่" };

  // เอาออกจากทีมเดิมก่อน (ถ้ามี) แล้วใส่ทีมใหม่
  await supabase
    .from("team_members")
    .delete()
    .in(
      "team_id",
      teams.map((t) => t.id)
    )
    .eq("profile_id", profileId);
  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, profile_id: profileId });
  if (error) return { error: "ใส่ผู้เล่นไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}

export async function removePlayerFromTeam(
  gameId: string,
  profileId: string
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const { data: teams } = await supabase
    .from("teams")
    .select("id, locked")
    .eq("game_id", gameId);
  if (!teams || teams.length === 0) return { error: "ยังไม่มีทีม" };
  if (teams.some((t) => t.locked)) return { error: "ทีมถูกล็อคอยู่" };

  const { error: delError } = await supabase
    .from("team_members")
    .delete()
    .in(
      "team_id",
      teams.map((t) => t.id)
    )
    .eq("profile_id", profileId);

  if (delError) return { error: "นำออกไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}

/** สุ่มเฉพาะคนที่ยังไม่มีทีม — คนที่จัดเองไว้แล้วอยู่ที่เดิม */
export async function fillRemainingTeams(gameId: string) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;

  const [{ data: teams }, { data: regs }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, locked, team_members(profile_id)")
      .eq("game_id", gameId),
    supabase
      .from("registrations")
      .select(
        "profile_id, profiles!profile_id(id, skill_rating, height_cm, weight_kg, player_positions(position, priority))"
      )
      .eq("game_id", gameId)
      .eq("status", "confirmed"),
  ]);
  if (!teams || teams.length === 0 || !regs) return;
  if (teams.some((t) => t.locked)) return;

  const players: BalancerPlayer[] = regs.map((r) => {
    const prof = r.profiles as unknown as {
      id: string;
      skill_rating: number;
      height_cm: number | null;
      weight_kg: number | null;
      player_positions: { position: string; priority: number }[];
    };
    return {
      id: prof.id,
      skill: Number(prof.skill_rating ?? 5),
      height: prof.height_cm ?? 175,
      weight: prof.weight_kg ?? 70,
      positions: (prof.player_positions ?? [])
        .sort((a, b) => a.priority - b.priority)
        .map((p) => p.position),
    };
  });
  const scores = compositeScores(players);

  const assigned = new Set(
    teams.flatMap((t) =>
      ((t.team_members ?? []) as { profile_id: string }[]).map(
        (m) => m.profile_id
      )
    )
  );
  const unassigned = players
    .filter((p) => !assigned.has(p.id))
    .sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0));
  if (unassigned.length === 0) return;

  // สถานะปัจจุบันของแต่ละทีม
  const state = teams.map((t) => {
    const members = (t.team_members ?? []) as { profile_id: string }[];
    return {
      id: t.id,
      size: members.length,
      strength: members.reduce(
        (s, m) => s + (scores.get(m.profile_id) ?? 0.5),
        0
      ),
    };
  });

  // คนเก่งสุดลงทีมที่อ่อนสุด (ถ้าเท่ากันลงทีมที่คนน้อยกว่า)
  const inserts: { team_id: string; profile_id: string }[] = [];
  for (const p of unassigned) {
    state.sort((a, b) => a.strength - b.strength || a.size - b.size);
    const target = state[0];
    inserts.push({ team_id: target.id, profile_id: p.id });
    target.strength += scores.get(p.id) ?? 0.5;
    target.size += 1;
  }
  await supabase.from("team_members").insert(inserts);

  revalidateTeams(gameId);
}

export async function swapPlayers(
  gameId: string,
  profileA: string,
  profileB: string
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const { data: teams } = await supabase
    .from("teams")
    .select("id, locked")
    .eq("game_id", gameId);
  if (!teams || teams.length === 0) return { error: "ยังไม่มีทีม" };
  if (teams.some((t) => t.locked)) return { error: "ทีมถูกล็อคอยู่" };

  const teamIds = teams.map((t) => t.id);
  const { data: members } = await supabase
    .from("team_members")
    .select("team_id, profile_id")
    .in("team_id", teamIds)
    .in("profile_id", [profileA, profileB]);

  const rowA = members?.find((m) => m.profile_id === profileA);
  const rowB = members?.find((m) => m.profile_id === profileB);
  if (!rowA || !rowB || rowA.team_id === rowB.team_id) {
    return { error: "เลือกผู้เล่นจากคนละทีม" };
  }

  await supabase
    .from("team_members")
    .update({ team_id: rowB.team_id })
    .eq("team_id", rowA.team_id)
    .eq("profile_id", profileA);
  await supabase
    .from("team_members")
    .update({ team_id: rowA.team_id })
    .eq("team_id", rowB.team_id)
    .eq("profile_id", profileB);

  revalidateTeams(gameId);
  return {};
}

/** ตั้ง/เปลี่ยนชื่อทีม (หลังจัดทีมเสร็จ) */
export async function renameTeam(
  gameId: string,
  teamId: string,
  name: string
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const n = name.trim();
  if (!n || n.length > 30) return { error: "ชื่อทีม 1–30 ตัวอักษร" };

  const { error } = await supabase
    .from("teams")
    .update({ name: n })
    .eq("id", teamId)
    .eq("game_id", gameId);
  if (error) return { error: "เปลี่ยนชื่อทีมไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}

export async function setTeamsLock(gameId: string, locked: boolean) {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return;
  await supabase.from("teams").update({ locked }).eq("game_id", gameId);

  // Announce final teams to every player in the game
  if (locked) {
    try {
      const [{ data: game }, { data: teams }] = await Promise.all([
        supabase.from("games").select("title").eq("id", gameId).single(),
        supabase
          .from("teams")
          .select("name, team_members(profile_id)")
          .eq("game_id", gameId),
      ]);
      for (const team of teams ?? []) {
        const memberIds = (
          (team.team_members ?? []) as { profile_id: string }[]
        ).map((m) => m.profile_id);
        await pushToProfiles(
          memberIds,
          `⚖️ ประกาศทีมแล้ว! Session "${game?.title ?? ""}"\nคุณอยู่ ${team.name} 🔥`,
          "teams_ready"
        );
      }
    } catch {
      // best-effort
    }
  }

  revalidateTeams(gameId);
}

/** เปลี่ยนตัวผู้เล่นระหว่างเกมส์: เอาคนเก่าออกจากทีม แล้วใส่คนใหม่เข้าไป */
export async function substitutePlayer(
  gameId: string,
  oldPlayerId: string,
  newPlayerId: string,
  teamId: string
): Promise<ActionState> {
  const { supabase, canManage } = await getGameEditorContext(gameId);
  if (!canManage) return { error: "คุณไม่มีสิทธิ์จัดการ Session นี้" };

  const { data: teams } = await supabase
    .from("teams")
    .select("id, locked")
    .eq("game_id", gameId);
  if (!teams?.some((t) => t.id === teamId)) return { error: "ไม่พบทีม" };
  if (teams.some((t) => t.locked)) return { error: "ทีมถูกล็อคอยู่" };

  // เอาคนเก่าออกจากทีม
  await supabase
    .from("team_members")
    .delete()
    .eq("team_id", teamId)
    .eq("profile_id", oldPlayerId);

  // เอาคนใหม่ออกจากทีมเดิมก่อน (ถ้ามี) แล้วใส่ทีมใหม่
  await supabase
    .from("team_members")
    .delete()
    .in("team_id", teams.map((t) => t.id))
    .eq("profile_id", newPlayerId);

  const { error } = await supabase
    .from("team_members")
    .insert({ team_id: teamId, profile_id: newPlayerId });
  if (error) return { error: "เปลี่ยนตัวไม่สำเร็จ" };

  revalidateTeams(gameId);
  return {};
}
