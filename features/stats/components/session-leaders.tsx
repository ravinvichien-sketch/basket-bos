import Image from "next/image";

export interface LeaderStatRow {
  profile_id: string;
  points: number;
  reb_off: number;
  reb_def: number;
  assists: number;
  steals: number;
  blocks: number;
}

interface PlayerInfo {
  profileId: string;
  nickname: string;
  avatarUrl: string | null;
}

const CATS = [
  { key: "points", label: "🔥 ทำแต้มสูงสุด", val: (r: LeaderStatRow) => r.points },
  {
    key: "reb",
    label: "💪 รีบาวด์สูงสุด",
    val: (r: LeaderStatRow) => r.reb_off + r.reb_def,
  },
  { key: "ast", label: "🎯 แอสซิสต์สูงสุด", val: (r: LeaderStatRow) => r.assists },
  { key: "stl", label: "🖐 สตีลสูงสุด", val: (r: LeaderStatRow) => r.steals },
  { key: "blk", label: "🔒 บล็อกสูงสุด", val: (r: LeaderStatRow) => r.blocks },
] as const;

const medal = (i: number) => ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`;

/** สรุปผู้เล่นเด่นของนัดนี้ (Top 3 ต่อหมวด) — คำนวณจากสถิติรวมทั้งนัด */
export function SessionLeaders({
  rows,
  players,
}: {
  rows: LeaderStatRow[];
  players: PlayerInfo[];
}) {
  const info = new Map(players.map((p) => [p.profileId, p]));
  const nameOf = (id: string) => info.get(id)?.nickname ?? "ผู้เล่น";

  if (rows.length === 0) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {CATS.map((cat) => {
        const top = [...rows]
          .map((r) => ({ id: r.profile_id, v: cat.val(r) }))
          .filter((x) => x.v > 0)
          .sort((a, b) => b.v - a.v)
          .slice(0, 3);
        if (top.length === 0) return null;
        return (
          <div
            key={cat.key}
            className="rounded-xl2 bg-surface-raised border border-white/5 p-3"
          >
            <p className="text-sm font-semibold text-ink-dim">{cat.label}</p>
            <ol className="mt-2 space-y-1.5">
              {top.map((x, i) => (
                <li key={x.id} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-center">{medal(i)}</span>
                  {info.get(x.id)?.avatarUrl ? (
                    <Image
                      src={info.get(x.id)!.avatarUrl!}
                      alt=""
                      width={22}
                      height={22}
                      className="rounded-full"
                    />
                  ) : (
                    <span className="h-[22px] w-[22px] rounded-full bg-surface-overlay flex items-center justify-center text-[11px]">
                      🏀
                    </span>
                  )}
                  <span className="flex-1 truncate">{nameOf(x.id)}</span>
                  <span className="font-bold tabular-nums">{x.v}</span>
                </li>
              ))}
            </ol>
          </div>
        );
      })}
    </div>
  );
}
