-- ============================================================
-- Migration 036: Fix create_group RPC return type
--   - returns groups (composite row) causes Supabase client issues
--   - Changed to returns uuid for compatibility
-- ============================================================

drop function if exists create_group(text, text);

create or replace function create_group(p_name text, p_line_group_id text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  if coalesce(trim(p_line_group_id), '') = '' then raise exception 'NO_LINE_GROUP'; end if;

  if not exists (select 1 from profiles where id = auth.uid() and onboarded = true) then
    raise exception 'NOT_ONBOARDED';
  end if;

  if exists (select 1 from groups where line_group_id = trim(p_line_group_id)) then
    raise exception 'LINE_GROUP_EXISTS';
  end if;

  insert into groups (name, line_group_id, created_by)
    values (trim(p_name), trim(p_line_group_id), auth.uid())
    returning id into gid;

  insert into group_members (group_id, profile_id, role)
    values (gid, auth.uid(), 'admin');

  return gid;
end $$;
revoke all on function create_group(text, text) from public, anon;
grant execute on function create_group(text, text) to authenticated;
