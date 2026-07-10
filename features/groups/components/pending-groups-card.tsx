"use client";

import { useTransition } from "react";
import { approveGroup, rejectGroup } from "@/features/groups/actions";
import { Card, CardTitle } from "@/components/ui/card";

interface PendingGroup {
  id: string;
  name: string;
  created_by: string;
}

export function PendingGroupsCard({ groups }: { groups: PendingGroup[] }) {
  const [pending, start] = useTransition();

  return (
    <Card className="border-amber-500/30">
      <CardTitle className="flex items-center gap-2">
        ⏳ รออนุมัติ ({groups.length})
      </CardTitle>
      <div className="mt-3 space-y-2">
        {groups.map((g) => (
          <div
            key={g.id}
            className="flex items-center justify-between rounded-lg bg-surface-overlay/50 px-3 py-2"
          >
            <span className="text-sm font-semibold">{g.name}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => start(() => { void approveGroup(g.id); })}
                disabled={pending}
                className="rounded-lg bg-emerald-500/15 text-emerald-400 px-3 py-1 text-xs font-semibold hover:bg-emerald-500/25 transition disabled:opacity-50"
              >
                อนุมัติ ✓
              </button>
              <button
                onClick={() => start(() => { void rejectGroup(g.id); })}
                disabled={pending}
                className="rounded-lg bg-red-500/10 text-red-400 px-3 py-1 text-xs hover:bg-red-500/25 transition disabled:opacity-50"
              >
                ปฏิเสธ ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
