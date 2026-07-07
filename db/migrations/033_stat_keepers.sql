-- ============================================================
-- Migration 033: Stat keepers — multi-recorder for live matches
--   - game_stat_keepers: who can record stats for a session
--   - Only group admin or acting admin can add stat keepers
-- ============================================================

create table game_stat_keepers (
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  added_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  primary key (game_id, profile_id)
);

alter table game_stat_keepers enable row level security;

create policy "gsk_select" on game_stat_keepers for select to authenticated
  using (true);

create policy "gsk_insert" on game_stat_keepers for insert to authenticated
  with check (
    exists (
      select 1 from games g
      left join group_members gm on gm.group_id = g.group_id and gm.profile_id = auth.uid()
      where g.id = game_id and (
        is_admin() or gm.role = 'admin' or g.acting_admin_id = auth.uid()
      )
    )
  );

create policy "gsk_delete" on game_stat_keepers for delete to authenticated
  using (
    exists (
      select 1 from games g
      left join group_members gm on gm.group_id = g.group_id and gm.profile_id = auth.uid()
      where g.id = game_id and (
        is_admin() or gm.role = 'admin' or g.acting_admin_id = auth.uid()
      )
    )
  );

-- Enable realtime for game_stat_keepers so stat keeper list updates in real-time
alter publication supabase_realtime add table game_stat_keepers;

-- Allow per-match stats: change unique constraint to include match_id
-- (needed for multiple stat keepers recording the same game)
alter table player_game_stats drop constraint if exists player_game_stats_game_id_profile_id_key;
alter table player_game_stats add constraint player_game_stats_game_id_profile_id_match_id_key
  unique (game_id, match_id, profile_id);
