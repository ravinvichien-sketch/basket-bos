-- ============================================================
-- Basket Bos — Migration 007:
--  1) สมาชิกทุกคนช่วยกรอกสถิติ/สกอร์ได้ (ไม่ใช่แค่แอดมิน)
--  2) ตาราง app_settings (เก็บ LINE group id สำหรับส่งอัพเดตเข้ากลุ่ม)
-- ============================================================

-- 1) เปิดให้สมาชิกบันทึกสถิติผู้เล่นและผลการแข่ง
drop policy if exists "stats_admin" on player_game_stats;
create policy "stats_insert_members" on player_game_stats
  for insert to authenticated with check (true);
create policy "stats_update_members" on player_game_stats
  for update to authenticated using (true) with check (true);
create policy "stats_delete_admin" on player_game_stats
  for delete to authenticated using (is_admin());

drop policy if exists "matches_admin" on matches;
create policy "matches_insert_members" on matches
  for insert to authenticated with check (true);
create policy "matches_update_members" on matches
  for update to authenticated using (true) with check (true);
create policy "matches_delete_admin" on matches
  for delete to authenticated using (is_admin());

-- 2) ค่าตั้งค่ากลางของแอป (เช่น LINE group ที่ผูกไว้)
create table app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
create policy "settings_select" on app_settings
  for select to authenticated using (true);
create policy "settings_admin" on app_settings
  for all to authenticated using (is_admin()) with check (is_admin());
