"use client";

import { useState, useTransition } from "react";
import {
  createDreamTeam,
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

  const handleCreate = () => {
    if (!teamName.trim() || selectedMembers.length === 0) return;
    start(async () => {
      const res = await createDreamTeam(teamName, selectedMembers);
      if (!res.error) {
        setShowCreate(false);
        setTeamName("");
        setSelectedMembers([]);
      }
    });
  };

  const toggleMember = (id: string) => {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

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
          <p className="text-xs text-ink-faint">เลือกสมาชิก (สูงสุด 15 คน รวมคุณ)</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
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
          <div className="flex gap-2">
            <button
              onClick={handleCreate}
              disabled={pending || !teamName.trim() || selectedMembers.length === 0}
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
        </div>
      )}

      {teams.map((team) => {
        const isOwner = team.owner_id === meId;
        const myMembership = team.members.find((m) => m.profile_id === meId);
        const accepted = team.members.filter((m) => m.status === "accepted");
        const pending_ = team.members.filter((m) => m.status === "pending");
        const myPendingInvite = myMembership?.status === "pending";

        return (
          <div key={team.id} className="rounded-xl bg-surface-overlay p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-sm">{team.name}</p>
                <p className="text-xs text-ink-faint">
                  โดย {team.owner_nickname} · {accepted.length} คน
                </p>
              </div>
              {myPendingInvite && (
                <div className="flex gap-1.5">
                  <button
                    onClick={() =>
                      start(() => { void respondToDreamTeamInvite(myMembership!.id, true, team.id); })
                    }
                    disabled={pending}
                    className="rounded-lg bg-green-500/15 text-green-400 px-2.5 py-1 text-xs font-semibold hover:bg-green-500/25 transition disabled:opacity-50"
                  >
                    รับ
                  </button>
                  <button
                    onClick={() =>
                      start(() => { void respondToDreamTeamInvite(myMembership!.id, false, team.id); })
                    }
                    disabled={pending}
                    className="rounded-lg bg-red-500/10 text-red-400 px-2.5 py-1 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
                  >
                    ปฏิเสธ
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {accepted.map((m) => (
                <span
                  key={m.profile_id}
                  className="inline-flex items-center gap-1 rounded-full bg-surface px-2.5 py-0.5 text-xs"
                >
                  🏀 {m.nickname}
                  {isOwner && m.profile_id !== meId && (
                    <button
                      onClick={() => start(() => { void removeDreamTeamMember(team.id, m.profile_id); })}
                      disabled={pending}
                      className="ml-0.5 text-red-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
            </div>

            {pending_.length > 0 && (
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
