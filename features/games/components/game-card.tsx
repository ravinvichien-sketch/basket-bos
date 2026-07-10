import Link from "next/link";
import type { Game, GameStatus } from "@/types/database";
import { GAME_STATUS_LABELS, GAME_STATUS_STYLES } from "../constants";
import { formatThaiDateTime, formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GameCard({
  game,
  confirmedCount,
  groupName,
}: {
  game: Game;
  confirmedCount?: number;
  groupName?: string | null;
}) {
  const status = game.status as GameStatus;

  const dateStr = formatThaiDateTime(game.starts_at);

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-xl2 bg-surface-raised border border-white/5 p-4 hover:border-court/40 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {groupName && (
            <p className="text-xs text-court font-semibold mb-0.5">
              🎯 {groupName}
            </p>
          )}
          <p className="text-sm text-ink-dim">
            📅 {dateStr}  {game.location ? `| ${game.location}` : ""}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
            GAME_STATUS_STYLES[status]
          )}
        >
          {GAME_STATUS_LABELS[status]}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="font-display font-bold tabular-nums">
          {confirmedCount ?? 0}/{game.max_players}{" "}
          <span className="font-sans font-normal text-ink-faint">คน</span>
        </span>
        <span className="text-ink-dim">
          {formatBaht(game.court_fee_thb)}
          {game.fee_mode === "fixed" && "/คน"}
        </span>
      </div>
    </Link>
  );
}
