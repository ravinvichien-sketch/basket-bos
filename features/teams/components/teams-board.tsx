"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  swapPlayers,
  assignPlayerToTeam,
  removePlayerFromTeam,
  renameTeam,
} from "../actions";
import { cn } from "@/lib/utils";

export interface TeamMemberView {
  profileId: string;
  nickname: string;
  avatarUrl: string | null;
  position: string | null;
  heightCm: number | null;
  skill: number;
}

export interface TeamView {
  id: string;
  name: string;
  color: string;
  members: TeamMemberView[];
}

function PlayerChip({
  player,
  selected,
  disabled,
  onTap,
}: {
  player: TeamMemberView;
  selected: boolean;
  disabled: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 py-2.5 text-left transition rounded-lg px-1",
        !disabled && "active:bg-surface-overlay",
        selected && "ring-2 ring-court bg-court/10"
      )}
    >
      {player.avatarUrl ? (
        <Image
          src={player.avatarUrl}
          alt=""
          width={32}
          height={32}
          className="rounded-full"
        />
      ) : (
        <span className="h-8 w-8 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
          🏀
        </span>
      )}
      <span className="flex-1 truncate text-sm">{player.nickname}</span>
      {player.heightCm && (
        <span className="text-xs text-ink-faint">{player.heightCm}cm</span>
      )}
      {player.position && (
        <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-xs font-bold text-ink-dim">
          {player.position}
        </span>
      )}
    </button>
  );
}

export function TeamsBoard({
  gameId,
  teams,
  unassigned,
  isAdmin,
  locked,
}: {
  gameId: string;
  teams: TeamView[];
  unassigned: TeamMemberView[];
  isAdmin: boolean;
  locked: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = isAdmin && !locked;
  const unassignedIds = new Set(unassigned.map((p) => p.profileId));

  function teamOf(profileId: string) {
    return teams.find((t) =>
      t.members.some((m) => m.profileId === profileId)
    );
  }

  function run(fn: () => Promise<{ error?: string } | void>) {
    startTransition(async () => {
      const res = await fn();
      if (res && "error" in res && res.error) setError(res.error);
    });
  }

  function handlePlayerTap(profileId: string) {
    if (!canEdit || isPending) return;
    setError(null);

    if (!selected) {
      setSelected(profileId);
      return;
    }
    if (selected === profileId) {
      setSelected(null);
      return;
    }

    const selTeam = teamOf(selected);
    const tapTeam = teamOf(profileId);

    // สลับสองคนคนละทีม
    if (selTeam && tapTeam && selTeam.id !== tapTeam.id) {
      const a = selected;
      setSelected(null);
      run(() => swapPlayers(gameId, a, profileId));
      return;
    }
    // คนที่เลือกอยู่ยังไม่มีทีม + แตะคนในทีม → ใส่แทนที่ตำแหน่งทีมนั้น (ใส่เข้าทีมเดียวกัน)
    if (unassignedIds.has(selected) && tapTeam) {
      const a = selected;
      setSelected(null);
      run(() => assignPlayerToTeam(gameId, a, tapTeam.id));
      return;
    }
    setSelected(profileId); // ทีมเดียวกัน — ย้าย selection
  }

  function handleTeamTap(teamId: string) {
    if (!canEdit || isPending || !selected) return;
    setError(null);
    const a = selected;
    setSelected(null);
    run(() => assignPlayerToTeam(gameId, a, teamId));
  }

  function handleRemove() {
    if (!selected) return;
    const a = selected;
    setSelected(null);
    run(() => removePlayerFromTeam(gameId, a));
  }

  function handleRename(teamId: string, current: string) {
    if (!isAdmin) return;
    const name = window.prompt("ตั้งชื่อทีมใหม่", current)?.trim();
    if (!name || name === current) return;
    setError(null);
    run(() => renameTeam(gameId, teamId, name));
  }

  const selectedInTeam = selected ? Boolean(teamOf(selected)) : false;

  return (
    <div className="space-y-4">
      {canEdit && (
        <p className="text-xs text-ink-faint text-center">
          แตะผู้เล่น → แตะหัวทีมเพื่อใส่ทีม · แตะผู้เล่น 2 คนคนละทีมเพื่อสลับ
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3 text-center">
          {error}
        </p>
      )}

      {selected && selectedInTeam && canEdit && (
        <button
          type="button"
          onClick={handleRemove}
          className="w-full h-10 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition"
        >
          นำ &ldquo;
          {
            [...teams.flatMap((t) => t.members), ...unassigned].find(
              (p) => p.profileId === selected
            )?.nickname
          }
          &rdquo; ออกจากทีม
        </button>
      )}

      {unassigned.length > 0 && (
        <div className="rounded-xl2 bg-surface-raised border border-dashed border-white/15 overflow-hidden">
          <div className="px-4 py-3 text-sm font-bold text-ink-dim">
            ยังไม่มีทีม ({unassigned.length})
          </div>
          <ul className="divide-y divide-white/5 px-4 pb-2">
            {unassigned.map((p) => (
              <li key={p.profileId}>
                <PlayerChip
                  player={p}
                  selected={selected === p.profileId}
                  disabled={!canEdit || isPending}
                  onTap={() => handlePlayerTap(p.profileId)}
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={cn("grid gap-4", teams.length > 2 && "sm:grid-cols-2")}>
        {teams.map((team) => {
          const avgSkill =
            team.members.length > 0
              ? team.members.reduce((s, m) => s + m.skill, 0) /
                team.members.length
              : 0;
          return (
            <div
              key={team.id}
              className="rounded-xl2 bg-surface-raised border border-white/5 overflow-hidden"
            >
              <button
                type="button"
                onClick={() => handleTeamTap(team.id)}
                disabled={!canEdit || !selected}
                className={cn(
                  "flex w-full items-center justify-between px-4 py-3 transition",
                  canEdit && selected && "ring-2 ring-inset ring-court/60"
                )}
                style={{ backgroundColor: `${team.color}22` }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: team.color }}
                  />
                  <span className="font-bold">{team.name}</span>
                  {canEdit && selected && (
                    <span className="text-xs text-court">← ใส่ทีมนี้</span>
                  )}
                </div>
                <span className="text-xs text-ink-dim">
                  {team.members.length} คน · AVG {avgSkill.toFixed(1)}
                </span>
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleRename(team.id, team.name)}
                  disabled={isPending}
                  className="w-full px-4 py-1.5 text-left text-xs text-court hover:bg-surface-overlay transition disabled:opacity-50"
                >
                  ✎ เปลี่ยนชื่อทีม
                </button>
              )}
              <ul className="divide-y divide-white/5 px-4 pb-2">
                {team.members.map((m) => (
                  <li key={m.profileId}>
                    <PlayerChip
                      player={m}
                      selected={selected === m.profileId}
                      disabled={!canEdit || isPending}
                      onTap={() => handlePlayerTap(m.profileId)}
                    />
                  </li>
                ))}
                {team.members.length === 0 && (
                  <li className="py-4 text-center text-xs text-ink-faint">
                    ยังไม่มีผู้เล่น
                  </li>
                )}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
