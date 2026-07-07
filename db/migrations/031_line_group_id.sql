-- ============================================================
-- Migration 031: LINE group ID requirement for creating groups
--   - ใครก็ตามที่ลงทะเบียนแล้วสามารถตั้งก๊วนได้ ถ้ามี LINE group
--   - ผู้ก่อตั้งก๊วน = admin
--   - แอดมินก๊วนสามารถยก admin ให้สมาชิกท่านอื่นได้
-- ============================================================

-- 1. Add line_group_id to groups (required for creation)
alter table groups add column line_group_id text;

-- 2. Replace create_group RPC — any onboarded user, requires line_group_id, auto-adds creator as admin
drop function if exists create_group(text);

create or replace function create_group(p_name text, p_line_group_id text)
returns groups
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  if coalesce(trim(p_line_group_id), '') = '' then raise exception 'NO_LINE_GROUP'; end if;

  if not exists (select 1 from profiles where id = auth.uid() and onboarded = true) then
    raise exception 'NOT_ONBOARDED';
  end if;

  insert into groups (name, line_group_id, created_by)
    values (trim(p_name), trim(p_line_group_id), auth.uid())
    returning * into g;

  insert into group_members (group_id, profile_id, role)
    values (g.id, auth.uid(), 'admin');

  return g;
end $$;
revoke all on function create_group(text, text) from public, anon;
grant execute on function create_group(text, text) to authenticated;

-- 3. Allow group admins to promote/demote other admins in their group
create or replace function set_group_member_admin(
  p_group_id uuid, p_profile_id uuid, p_value boolean
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or is_group_admin_of(p_group_id)) then
    raise exception 'FORBIDDEN';
  end if;

  if p_value then
    insert into group_members (group_id, profile_id, role)
      values (p_group_id, p_profile_id, 'admin')
      on conflict (group_id, profile_id) do update set role = 'admin';
  else
    delete from group_members
      where group_id = p_group_id and profile_id = p_profile_id;
  end if;
end $$;
revoke all on function set_group_member_admin(uuid, uuid, boolean) from public, anon;
grant execute on function set_group_member_admin(uuid, uuid, boolean) to authenticated;

-- 4. Allow group admins to rename their group
create or replace function rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (is_admin() or is_group_admin_of(p_group_id)) then
    raise exception 'FORBIDDEN';
  end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  update groups set name = trim(p_name) where id = p_group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
end $$;
revoke all on function rename_group(uuid, text) from public, anon;
grant execute on function rename_group(uuid, text) to authenticated;
