-- ============================================================
-- Migration 050: Make LINE group ID optional in create_group RPC
-- ============================================================

drop function if exists create_group(p_name text, p_line_group_id text, p_play_start_time time, p_play_end_time time);

create or replace function create_group(
  p_name text,
  p_line_group_id text default null,
  p_play_start_time time default null,
  p_play_end_time time default null
)
returns groups
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
  v_profile_id uuid;
begin
  if p_name is null or trim(p_name) = '' then
    raise exception 'name is required' using hint = 'NAME_REQUIRED';
  end if;

  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'not authenticated' using hint = 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from profiles where id = v_profile_id and onboarded = true) then
    raise exception 'profile not onboarded' using hint = 'NOT_ONBOARDED';
  end if;

  if p_line_group_id is not null and trim(p_line_group_id) != '' then
    if exists (select 1 from groups where line_group_id = p_line_group_id and deleted_at is null) then
      raise exception 'line_group_id already in use' using hint = 'LINE_GROUP_EXISTS';
    end if;
  end if;

  insert into groups (name, line_group_id, created_by, status, play_start_time, play_end_time)
  values (
    trim(p_name),
    nullif(trim(p_line_group_id), ''),
    v_profile_id,
    'pending',
    p_play_start_time,
    p_play_end_time
  )
  returning * into g;

  -- Creator becomes admin of the group
  insert into group_members (group_id, profile_id, role)
  values (g.id, v_profile_id, 'admin');

  return g;
end $$;

revoke all on function create_group(text, text, time, time) from public, anon;
grant execute on function create_group(text, text, time, time) to authenticated;
