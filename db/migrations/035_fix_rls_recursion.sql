-- ============================================================
-- Migration 035: Fix RLS recursion in group visibility policies
--   - Use security definer helper to avoid recursive subqueries
--   - Old policies referenced group_members from within
--     group_members_select causing "infinite recursion detected"
-- ============================================================

-- Helper: is user a member of this group? (bypasses RLS via security definer)
create or replace function is_group_member_of(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = p_group_id and profile_id = auth.uid()
  );
$$;
revoke all on function is_group_member_of(uuid) from public, anon;
grant execute on function is_group_member_of(uuid) to authenticated;

-- Fix groups_select — use helper instead of direct subquery
drop policy if exists "groups_select" on groups;
create policy "groups_select" on groups for select to authenticated
  using (is_admin() or is_group_member_of(id));

-- Fix group_members_select — use helper to avoid recursion
drop policy if exists "group_members_select" on group_members;
create policy "group_members_select" on group_members for select to authenticated
  using (is_admin() or is_group_member_of(group_id));
