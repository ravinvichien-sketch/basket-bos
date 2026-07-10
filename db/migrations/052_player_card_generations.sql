-- ============================================================
-- Migration 052: Track player card generations per session
-- Enforces "one generation per session per player"
-- ============================================================

create table player_card_generations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  card_url text,
  ai_image_url text,
  created_at timestamptz not null default now(),
  unique (game_id, profile_id)
);

alter table player_card_generations enable row level security;

-- All authenticated users can view generations
create policy "card_gen_select_public" on player_card_generations
  for select to authenticated using (true);

-- Players can insert their own generation (enforced via unique constraint)
create policy "card_gen_insert_own" on player_card_generations
  for insert to authenticated
  with check (profile_id = auth.uid());
