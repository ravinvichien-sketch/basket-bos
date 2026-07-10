-- ============================================================
-- Migration 042: plus_minus สำหรับผู้เล่น และ MVP calculator
--   - เพิ่ม plus_minus column ใน player_game_stats
--   - อัปเดต v_player_season_stats view ให้มี plus_minus รวม
--   - ฟังก์ชัน compute_mvp: ให้คะแนนผู้เล่นแต่ละคนในแต่ละเกมส์
--     (NBA Game Score formula: PTS + 0.4*FG - 0.7*FGA - 0.4*(FTA-FTM) + 0.7*OREB
--      + 0.3*DREB + STL + 0.7*AST + 0.7*BLK - 0.4*PF - TOV)
-- ============================================================

alter table player_game_stats add column if not exists plus_minus smallint;

-- ฟังก์ชันคำนวณ Game Score (NBA-style efficiency rating)
create or replace function compute_game_score(
  p_points int, p_fgm int, p_fga int,
  p_tpm int, p_tpa int, p_ftm int, p_fta int,
  p_oreb int, p_dreb int,
  p_ast int, p_stl int, p_blk int, p_tov int, p_pf int
) returns numeric
language sql immutable as $$
  select p_points
    + 0.4 * p_fgm - 0.7 * p_fga
    - 0.4 * (p_fta - p_ftm)
    + 0.7 * p_oreb + 0.3 * p_dreb
    + p_stl + 0.7 * p_ast + 0.7 * p_blk
    - 0.4 * p_pf - p_tov;
$$;

-- อัปเดต season stats view
drop view if exists v_player_season_stats;
create or replace view v_player_season_stats with (security_invoker = on) as
select
  pgs.profile_id,
  count(*) as games_played,
  sum(pgs.minutes) as total_minutes,
  sum(pgs.points) as total_points,
  round(avg(pgs.points), 1) as ppg,
  round(avg(pgs.assists), 1) as apg,
  round(avg(pgs.reb_off + pgs.reb_def), 1) as rpg,
  round(avg(pgs.steals), 1) as spg,
  round(avg(pgs.blocks), 1) as bpg,
  sum(pgs.fgm) as total_fgm,
  sum(pgs.fga) as total_fga,
  sum(pgs.tpm) as total_tpm,
  sum(pgs.tpa) as total_tpa,
  sum(pgs.ftm) as total_ftm,
  sum(pgs.fta) as total_fta,
  case when sum(pgs.fga) > 0
    then round(100.0 * sum(pgs.fgm) / sum(pgs.fga), 1) else null end as fg_pct,
  case when sum(pgs.tpa) > 0
    then round(100.0 * sum(pgs.tpm) / sum(pgs.tpa), 1) else null end as tp_pct,
  -- sum(pgs.offensive_fouls) as total_offensive_fouls,
  sum(pgs.reb_off) as total_reb_off,
  sum(pgs.reb_def) as total_reb_def,
  count(*) filter (where pgs.is_mvp) as mvp_count,
  sum(pgs.plus_minus) as total_plus_minus,
  round(avg(coalesce(pgs.plus_minus, 0)), 1) as avg_plus_minus
from player_game_stats pgs
group by pgs.profile_id;