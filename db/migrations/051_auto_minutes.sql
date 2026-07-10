-- ============================================================
-- Migration 051: Auto-calculate minutes for old live-scored games
-- For each finished match, set player_game_stats.minutes
-- based on game duration distributed to all players in that match
-- ============================================================

-- First, update minutes for matches recorded via live scoring
-- (where timer data exists or where minutes are still 0)
update player_game_stats pgs
set minutes = g.game_duration_minutes
from matches m
  join games g on g.id = m.game_id
where pgs.match_id = m.id
  and m.status = 'finished'
  and pgs.minutes = 0
  and g.game_duration_minutes > 0;

-- For matches without game_duration (fallback: estimate from matches created_at)
update player_game_stats pgs
set minutes = 40
from matches m
where pgs.match_id = m.id
  and m.status = 'finished'
  and pgs.minutes = 0;
