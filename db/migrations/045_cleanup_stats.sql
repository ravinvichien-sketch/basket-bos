-- ============================================================
-- Migration 045: Cleanup — remove duplicate session-level rows
--               + backfill team_id for existing per-match stats
-- ============================================================

-- 1. ลบ session-level rows (match_id IS NULL) ที่ซ้ำกับ per-match rows
--    (เก็บเฉพาะ per-match rows ซึ่งมี match_id)
delete from player_game_stats p
where p.match_id is null
  and exists (
    select 1 from player_game_stats p2
    where p2.game_id = p.game_id
      and p2.profile_id = p.profile_id
      and p2.match_id is not null
  );

-- 2. Backfill team_id ตาม current team_members สำหรับ stats เก่า
update player_game_stats p
set team_id = tm.team_id
from team_members tm
where p.match_id is not null
  and p.team_id is null
  and tm.profile_id = p.profile_id
  and exists (
    select 1 from matches m
    where m.id = p.match_id
      and (m.team_a = tm.team_id or m.team_b = tm.team_id)
  );
