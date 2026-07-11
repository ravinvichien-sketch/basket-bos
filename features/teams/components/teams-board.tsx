"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  swapPlayers,
  assignPlayerToTeam,
  removePlayerFromTeam,
  renameTeam,
  batchAssignPlayersToTeam,
  batchRemovePlayersFromTeam,
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
  checked,
  disabled,
  showCheckbox,
  onTap,
  onCheckToggle,
}: {
  player: TeamMemberView;
  selected: boolean;
  checked: boolean;
  disabled: boolean;
  showCheckbox: boolean;
  onTap: () => void;
  onCheckToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {showCheckbox && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onCheckToggle(); }}
          className={cn(
            "shrink-0 w-6 h-6 rounded border transition flex items-center justify-center",
            checked
              ? "bg-court border-court text-white"
              : "border-white/20 hover:border-court/60"
          )}
        >
          {checked && <span className="text-xs">✓</span>}
        </button>
      )}
      <button
        type="button"
        onClick={onTap}
        disabled={disabled}
        className={cn(
          "flex w-full items-center gap-3 py-2.5 text-left transition rounded-lg px-1",
          !disabled && "active:bg-surface-overlay",
          selected && !showCheckbox && "ring-2 ring-court bg-court/10"
        )}
      >
        {player.avatarUrl ? (
          <Image
            src={player.avatarUrl}
            alt=""
            width={32}
            height={32}
            className="rounded-full shrink-0"
          />
        ) : (
          <span className="h-8 w-8 shrink-0 rounded-full bg-surface-overlay flex items-center justify-center text-sm">
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
    </div>
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
  const [checkedPlayers, setCheckedPlayers] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const canEdit = isAdmin && !locked;
  const unassignedIds = new Set(unassigned.map((p) => p.profileId));
  const hasChecked = checkedPlayers.size > 0;

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

  function toggleCheck(profileId: string) {
    setCheckedPlayers((prev) => {
      const next = new Set(prev);
      if (next.has(profileId)) next.delete(profileId);
      else next.add(profileId);
      return next;
    });
  }

  function handlePlayerTap(profileId: string) {
    if (!canEdit || isPending) return;
    setError(null);
    if (hasChecked) {
      toggleCheck(profileId);
      return;
    }
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

    if (selTeam && tapTeam && selTeam.id !== tapTeam.id) {
      const a = selected;
      setSelected(null);
      run(() => swapPlayers(gameId, a, profileId));
      return;
    }
    if (unassignedIds.has(selected) && tapTeam) {
      const a = selected;
      setSelected(null);
      run(() => assignPlayerToTeam(gameId, a, tapTeam.id));
      return;
    }
    setSelected(profileId);
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

  function handleBatchAssign(teamId: string) {
    if (!canEdit || checkedPlayers.size === 0) return;
    const ids = Array.from(checkedPlayers);
    setCheckedPlayers(new Set());
    run(() => batchAssignPlayersToTeam(gameId, ids, teamId));
  }

  function handleBatchRemove() {
    if (!canEdit || checkedPlayers.size === 0) return;
    const ids = Array.from(checkedPlayers);
    setCheckedPlayers(new Set());
    run(() => batchRemovePlayersFromTeam(gameId, ids));
  }

  function handleBatchClear() {
    setCheckedPlayers(new Set());
  }

  function handleRename(teamId: string, current: string) {
    if (!isAdmin) return;
    const name = window.prompt("ตั้งชื่อทีมใหม่", current)?.trim();
    if (!name || name === current) return;
    setError(null);
    run(() => renameTeam(gameId, teamId, name));
  }

  const selectedInTeam = selected ? Boolean(teamOf(selected)) : false;
  const allPlayers = [...unassigned, ...teams.flatMap((t) => t.members)];

  return (
    <div className="space-y-4">
      {canEdit && !hasChecked && (
        <p className="text-xs text-ink-faint text-center">
          แตะผู้เล่น → แตะหัวทีมเพื่อใส่ทีม · แตะผู้เล่น 2 คนคนละทีมเพื่อสลับ · ☐ เลือกทีละหลายคน
        </p>
      )}

      {error && (
        <p className="rounded-xl bg-red-500/10 text-red-400 text-sm px-4 py-3 text-center">
          {error}
        </p>
      )}

      {/* Batch action bar */}
      {hasChecked && canEdit && (
        <div className="rounded-xl2 bg-court/10 border border-court/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-court">
              เลือก {checkedPlayers.size} คน
            </p>
            <button
              type="button"
              onClick={handleBatchClear}
              className="text-[11px] text-ink-faint hover:text-ink transition"
            >
              ยกเลิก
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {teams.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleBatchAssign(t.id)}
                disabled={isPending}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50"
                style={{ backgroundColor: `${t.color}22`, color: t.color }}
              >
                → {t.name}
              </button>
            ))}
            <button
              type="button"
              onClick={handleBatchRemove}
              disabled={isPending}
              className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50"
            >
              ✕ นำออก
            </button>
          </div>
        </div>
      )}

      {!hasChecked && selected && selectedInTeam && canEdit && (
        <button
          type="button"
          onClick={handleRemove}
          className="w-full h-10 rounded-xl bg-red-500/10 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition"
        >
          นำ &ldquo;
          {allPlayers.find((p) => p.profileId === selected)?.nickname}
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
                  checked={checkedPlayers.has(p.profileId)}
                  disabled={!canEdit || isPending}
                  showCheckbox={canEdit}
                  onTap={() => handlePlayerTap(p.profileId)}
                  onCheckToggle={() => toggleCheck(p.profileId)}
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
                disabled={!canEdit || !selected || isPending}
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
                      checked={checkedPlayers.has(m.profileId)}
                      disabled={!canEdit || isPending}
                      showCheckbox={canEdit}
                      onTap={() => handlePlayerTap(m.profileId)}
                      onCheckToggle={() => toggleCheck(m.profileId)}
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
