-- Add match_id to player_game_stats for per-match stat tracking
alter table player_game_stats add column if not exists match_id uuid references matches(id) on delete set null;

-- Index for faster queries by match_id
create index if not exists idx_pgs_match_id on player_game_stats(match_id);
