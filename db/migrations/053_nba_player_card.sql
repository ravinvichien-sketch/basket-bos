-- ============================================================
-- Migration 053: Add NBA player card info to player_card_generations
-- ============================================================

alter table player_card_generations
  add column if not exists nba_player_name text,
  add column if not exists nba_player_tier text,
  add column if not exists nba_player_image_url text;
