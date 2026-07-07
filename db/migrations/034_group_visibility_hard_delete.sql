-- ============================================================
-- Migration 034: Group visibility + hard delete
--   1) RLS: ดู groups ได้เฉพาะสมาชิก (และ super admin)
--   2) RLS: group detail (group_members) ก็เฉพาะสมาชิก    
--   3) ลบ session — hard delete, super admin เท่านั้น
-- ============================================================

-- ── 1. groups RLS: เฉพาะสมาชิกของก๊วนนั้น หรือ super admin ──
drop policy if exists "groups_select" on groups;
create policy "groups_select" on groups for select to authenticated
  using (
    is_admin() or
    exists (
      select 1 from group_members
      where group_id = groups.id
        and profile_id = auth.uid()
    )
  );

-- ── 2. group_members RLS: เฉพาะสมาชิกของก๊วนนั้น หรือ super admin ──
drop policy if exists "group_members_select" on group_members;
create policy "group_members_select" on group_members for select to authenticated
  using (
    is_admin() or
    group_id in (
      select group_id from group_members
      where profile_id = auth.uid()
    )
  );

-- ── 3. Replace delete_game_session: super admin only + hard delete ──
drop function if exists delete_game_session(uuid);

create or replace function delete_game_session(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  if not exists (select 1 from games where id = p_game_id) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  delete from games where id = p_game_id;
end $$;
revoke all on function delete_game_session(uuid) from public, anon;
grant execute on function delete_game_session(uuid) to authenticated;
