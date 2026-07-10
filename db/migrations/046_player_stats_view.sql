-- ============================================================
-- Migration 046: เพิ่ม total columns ใน v_player_season_stats
--               (total_assists, total_steals, total_blocks,
--                total_turnovers, total_fouls)
-- ============================================================

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
  sum(pgs.reb_off) as total_reb_off,
  sum(pgs.reb_def) as total_reb_def,
  sum(pgs.assists) as total_assists,
  sum(pgs.steals) as total_steals,
  sum(pgs.blocks) as total_blocks,
  sum(pgs.turnovers) as total_turnovers,
  sum(pgs.fouls) as total_fouls,
  count(*) filter (where pgs.is_mvp) as mvp_count,
  sum(pgs.plus_minus) as total_plus_minus,
  round(avg(coalesce(pgs.plus_minus, 0)), 1) as avg_plus_minus
from player_game_stats pgs
group by pgs.profile_id;
