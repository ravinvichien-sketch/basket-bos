-- ============================================================
-- FIX: "relation player_card_generations does not exist"
-- สาเหตุ: DB ยังไม่ได้รัน migration 052 (ตารางยังไม่มี) ทำให้ 053 (alter) พัง
-- วิธีใช้: ก็อปทั้งไฟล์นี้ วางใน Supabase → SQL Editor → กด Run ครั้งเดียว
-- ปลอดภัย: เขียนแบบ idempotent รันซ้ำได้ ไม่กระทบข้อมูลเดิม
-- ============================================================

-- ---------- ส่วนของ migration 052 (สร้างตารางที่ขาด) ----------
create table if not exists player_card_generations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  card_url text,
  ai_image_url text,
  created_at timestamptz not null default now(),
  unique (game_id, profile_id)
);

alter table player_card_generations enable row level security;

drop policy if exists "card_gen_select_public" on player_card_generations;
create policy "card_gen_select_public" on player_card_generations
  for select to authenticated using (true);

drop policy if exists "card_gen_insert_own" on player_card_generations;
create policy "card_gen_insert_own" on player_card_generations
  for insert to authenticated
  with check (profile_id = auth.uid());

-- ---------- ส่วนของ migration 053 (คอลัมน์ NBA player ของ open code) ----------
alter table player_card_generations
  add column if not exists nba_player_name text,
  add column if not exists nba_player_tier text,
  add column if not exists nba_player_image_url text;

-- ============================================================
-- เสร็จแล้ว: ตาราง player_card_generations พร้อมคอลัมน์ NBA player ครบ
-- ============================================================
