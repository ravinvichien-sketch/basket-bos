"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import {
  createDreamTeam,
  deleteDreamTeam,
  inviteToDreamTeam,
  respondToDreamTeamInvite,
  removeDreamTeamMember,
} from "@/features/groups/actions";

export interface DreamTeamView {
  id: string;
  name: string;
  owner_id: string;
  owner_nickname: string;
  members: {
    id: string;
    profile_id: string;
    nickname: string;
    avatar_url: string | null;
    status: string;
  }[];
}

export function DreamTeamSection({
  teams,
  meId,
  candidates,
}: {
  teams: DreamTeamView[];
  meId: string;
  candidates: { id: string; nickname: string }[];
}) {
  const [pending, start] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [teamName, setTeamName] = useState("");
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const handleCreate = () => {
    if (!teamName.trim()) return;
    setCreateError(null);
    start(async () => {
      const res = await createDreamTeam(teamName, selectedMembers);
      if (res.error) {
        setCreateError(res.error);
      } else {
        setShowCreate(false);
        setTeamName("");
        setSelectedMembers([]);
        setCreateError(null);
      }
    });
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddMembers = (teamId: string) => {
    start(async () => {
      const res = await inviteToDreamTeam(teamId, selectedMembers);
      if (!res.error) {
        setEditingTeam(null);
        setSelectedMembers([]);
      }
    });
  };

  const filteredCandidates = (teamId: string) =>
    candidates.filter(
      (c) => !teams.find((t) => t.id === teamId)?.members.some((m) => m.profile_id === c.id && m.status === "accepted")
    );

  return (
    <div className="space-y-4">
      {!showCreate && teams.length < 3 && (
        <button
          onClick={() => setShowCreate(true)}
          className="w-full rounded-xl bg-court py-2 text-sm font-semibold text-white hover:bg-court-dark transition"
        >
          + สร้าง Dream Team
        </button>
      )}

      {showCreate && (
        <div className="rounded-xl bg-surface-overlay p-3 space-y-3">
          <input
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            placeholder="ชื่อทีม"
            maxLength={60}
            className="h-10 w-full rounded-xl bg-surface border border-white/10 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-court"
            disabled={pending}
          />
          <details className="group">
            <summary className="cursor-pointer text-xs text-ink-faint hover:text-ink-dim transition select-none">
              {selectedMembers.length > 0
                ? `✓ เลือกสมาชิก ${selectedMembers.length} คนแล้ว — กดเพื่อแก้ไข`
                : `เลือกสมาชิก (ไม่บังคับ) — กดเพื่อเลือก — สูงสุด 14 คน`}
            </summary>
            <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
              {candidates.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/5 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(c.id)}
                    onChange={() => toggleMember(c.id)}
                    disabled={pending}
                    className="accent-court"
                  />
                  {c.nickname}
                </label>
              ))}
              {candidates.length === 0 && (
                <p className="text-xs text-ink-faint py-2 text-center">ไม่มีผู้เล่นให้เลือก</p>
              )}
            </div>
          </details>
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={pending || !teamName.trim()}
              className="flex-1 rounded-xl bg-court py-2 text-sm font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
            >
              สร้าง
            </button>
            <button
              onClick={() => setShowCreate(false)}
              disabled={pending}
              className="rounded-xl bg-surface-overlay px-4 py-2 text-sm hover:bg-surface transition"
            >
              ยกเลิก
            </button>
          </div>
          {createError && (
            <p className="text-xs text-red-400">{createError}</p>
          )}
        </div>
      )}

      {teams.map((team) => {
        const isOwner = team.owner_id === meId;
        const myMembership = team.members.find((m) => m.profile_id === meId);
        const accepted = team.members.filter((m) => m.status === "accepted");
        const pending_ = team.members.filter((m) => m.status === "pending");
        const myPendingInvite = myMembership?.status === "pending";
        const editing = editingTeam === team.id;

        return (
          <div key={team.id} className="rounded-xl bg-surface-overlay p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{team.name}</p>
                <p className="text-xs text-ink-faint">
                  โดย {team.owner_nickname} · {accepted.length} คน
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {myPendingInvite && (
                  <>
                    <button
                      onClick={() => start(() => { void respondToDreamTeamInvite(myMembership!.id, true, team.id); })}
                      disabled={pending}
                      className="rounded-lg bg-green-500/15 text-green-400 px-2.5 py-1 text-xs font-semibold hover:bg-green-500/25 transition disabled:opacity-50"
                    >
                      รับ
                    </button>
                    <button
                      onClick={() => start(() => { void respondToDreamTeamInvite(myMembership!.id, false, team.id); })}
                      disabled={pending}
                      className="rounded-lg bg-red-500/10 text-red-400 px-2.5 py-1 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
                    >
                      ปฏิเสธ
                    </button>
                  </>
                )}
                {isOwner && !editing && (
                  <button
                    onClick={() => { setEditingTeam(team.id); setSelectedMembers([]); }}
                    className="text-xs text-ink-faint hover:text-ink-dim transition px-1.5"
                  >
                    ⚙️
                  </button>
                )}
              </div>
            </div>

            {/* Pending invites action for non-owner */}
            {!isOwner && pending_.length > 0 && (
              <p className="text-xs text-ink-faint">⏳ รอ {pending_.length} คนตอบรับ</p>
            )}

            {/* Owner actions: edit mode */}
            {editing && isOwner && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                <p className="text-xs font-semibold text-ink-dim">เพิ่มสมาชิก</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredCandidates(team.id).length === 0 ? (
                    <p className="text-xs text-ink-faint py-1">ไม่มีผู้เล่นเพิ่มได้อีก</p>
                  ) : (
                    filteredCandidates(team.id).map((c) => (
                      <label key={c.id} className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(c.id)}
                          onChange={() => toggleMember(c.id)}
                          disabled={pending}
                          className="accent-court"
                        />
                        {c.nickname}
                      </label>
                    ))
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddMembers(team.id)}
                    disabled={pending || selectedMembers.length === 0}
                    className="flex-1 rounded-lg bg-court py-1.5 text-xs font-semibold text-white hover:bg-court-dark transition disabled:opacity-50"
                  >
                    เชิญสมาชิก
                  </button>
                  <button
                    onClick={() => setEditingTeam(null)}
                    disabled={pending}
                    className="rounded-lg bg-surface px-3 py-1.5 text-xs hover:bg-surface/70 transition"
                  >
                    เสร็จ
                  </button>
                </div>
                {confirmDelete === team.id ? (
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs text-red-400">ลบทีมนี้?</span>
                    <button
                      onClick={() => start(async () => { await deleteDreamTeam(team.id); setConfirmDelete(null); })}
                      disabled={pending}
                      className="rounded-lg bg-red-500/15 text-red-400 px-2.5 py-1 text-xs font-semibold hover:bg-red-500/25 transition"
                    >
                      ยืนยัน
                    </button>
                    <button
                      onClick={() => setConfirmDelete(null)}
                      className="text-xs text-ink-faint hover:text-ink-dim transition"
                    >
                      ยกเลิก
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(team.id)}
                    className="text-xs text-red-400/60 hover:text-red-400 transition"
                  >
                    ลบทีมนี้
                  </button>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {accepted.map((m) => (
                <div
                  key={m.profile_id}
                  className="flex items-center gap-1.5 rounded-full bg-surface px-2 py-0.5 text-xs"
                >
                  {m.avatar_url ? (
                    <Image
                      src={m.avatar_url}
                      alt=""
                      width={18}
                      height={18}
                      className="rounded-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px]">🏀</span>
                  )}
                  <span>{m.nickname}</span>
                  {isOwner && m.profile_id !== meId && editing && (
                    <button
                      onClick={() => start(() => { void removeDreamTeamMember(team.id, m.profile_id); })}
                      disabled={pending}
                      className="ml-0.5 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pending_.length > 0 && isOwner && (
              <p className="text-xs text-ink-faint">
                ⏳ รอ {pending_.length} คนตอบรับ
              </p>
            )}
          </div>
        );
      })}

      {teams.length === 0 && !showCreate && (
        <p className="text-center text-sm text-ink-faint py-4">
          ยังไม่มี Dream Team — กดสร้างด้านบน
        </p>
      )}
    </div>
  );
}
