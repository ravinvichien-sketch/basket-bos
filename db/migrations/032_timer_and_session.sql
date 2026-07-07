-- ============================================================
-- Migration 032: Timer + game flow + per-game stats
--   - games: game_duration_minutes, target_score
--   - matches: status, timer fields
-- ============================================================

alter table games add column game_duration_minutes int not null default 8;
alter table games add column target_score int default null;

alter table matches add column status text not null default 'pending'
  check (status in ('pending', 'playing', 'finished'));
alter table matches add column timer_seconds int default null;
alter table matches add column timer_started_at timestamptz default null;
alter table matches add column timer_running boolean default false;

-- Allow group admins to manage matches in their group sessions
create or replace function is_group_admin_of_game(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from games g
    join group_members gm on gm.group_id = g.group_id
    where g.id = p_game_id
      and gm.profile_id = auth.uid()
      and gm.role = 'admin'
  );
$$;
revoke all on function is_group_admin_of_game(uuid) from public, anon;
grant execute on function is_group_admin_of_game(uuid) to authenticated;

-- Enable realtime for matches table (needed for timer sync)
alter publication supabase_realtime add table matches;
