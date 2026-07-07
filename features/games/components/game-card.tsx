import Link from "next/link";
import type { Game, GameStatus } from "@/types/database";
import { GAME_STATUS_LABELS, GAME_STATUS_STYLES } from "../constants";
import { formatThaiDateTime, formatTimeRange, formatBaht } from "@/lib/format";
import { cn } from "@/lib/utils";

export function GameCard({
  game,
  confirmedCount,
}: {
  game: Game;
  confirmedCount?: number;
}) {
  const status = game.status as GameStatus;

  return (
    <Link
      href={`/games/${game.id}`}
      className="block rounded-xl2 bg-surface-raised border border-white/5 p-4 hover:border-court/40 transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold truncate">{game.title}</h3>
          <p className="text-sm text-ink-dim mt-0.5">
            {formatThaiDateTime(game.starts_at)} ·{" "}
            {formatTimeRange(game.starts_at, game.ends_at)}
          </p>
          <p className="text-sm text-ink-faint truncate">📍 {game.location}</p>
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
