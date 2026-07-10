-- ============================================================
-- Migration 048: Group approval system
-- ============================================================

alter table groups add column status text not null default 'approved'
  check (status in ('pending', 'approved', 'rejected'));
alter table groups add column reviewed_at timestamptz;
alter table groups add column reviewed_by uuid references profiles(id);

-- Existing groups are all approved
update groups set status = 'approved';

-- Update RLS: approved groups visible to all, pending only to creator + admin
drop policy if exists "groups_select" on groups;
create policy "groups_select" on groups for select to authenticated
  using (
    status = 'approved' or
    is_admin() or
    created_by = auth.uid()
  );

-- Update create_group RPC to set status = 'pending'
create or replace function create_group(
  p_name text,
  p_line_group_id text,
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

  if p_line_group_id is null or trim(p_line_group_id) = '' then
    raise exception 'line_group_id is required' using hint = 'LINE_GROUP_REQUIRED';
  end if;

  v_profile_id := auth.uid();
  if v_profile_id is null then
    raise exception 'not authenticated' using hint = 'NOT_AUTHENTICATED';
  end if;

  if not exists (select 1 from profiles where id = v_profile_id and onboarded = true) then
    raise exception 'profile not onboarded' using hint = 'NOT_ONBOARDED';
  end if;

  if exists (select 1 from groups where line_group_id = p_line_group_id and deleted_at is null) then
    raise exception 'line_group_id already in use' using hint = 'LINE_GROUP_EXISTS';
  end if;

  insert into groups (name, line_group_id, created_by, status, play_start_time, play_end_time)
  values (
    trim(p_name),
    trim(p_line_group_id),
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
