-- ============================================================
-- Basket Bos — Migration 011: แอดมินก๊วน (สิทธิ์จำกัด)
--   โครงสิทธิ์ 3 ชั้น:
--     1) แอดมินเต็มระบบ  = profiles.role = 'admin'   (แต่งตั้งแอดมินก๊วนได้)
--     2) แอดมินก๊วน       = profiles.is_group_admin   (ทำได้แค่แต่งตั้งคนเก็บเงิน)
--     3) คนเก็บเงิน        = games.collector_profile_id (จัดการยอดจ่าย)
-- ============================================================

-- ธงแอดมินก๊วน (แยกจาก role เต็มระบบ ไม่ได้สิทธิ์แอดมินอื่น ๆ)
alter table profiles add column is_group_admin boolean not null default false;

-- ใครมีสิทธิ์ "แต่งตั้งคนเก็บเงิน" = แอดมินเต็มระบบ หรือ แอดมินก๊วน
create or replace function can_manage_collector()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles
    where id = auth.uid() and (role = 'admin' or is_group_admin)
  );
$$;
revoke all on function can_manage_collector() from public, anon;
grant execute on function can_manage_collector() to authenticated;

-- แต่งตั้งคนเก็บเงินของเกม (อัปเดตได้เฉพาะคอลัมน์ collector เท่านั้น)
--   ใช้ security definer เพื่อให้แอดมินก๊วน (ที่ไม่ผ่าน games_admin RLS) ทำได้
--   แต่จำกัดให้แก้ได้แค่ collector_profile_id — ฟิลด์อื่นของเกมแตะไม่ได้
create or replace function set_game_collector(p_game_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not can_manage_collector() then raise exception 'FORBIDDEN'; end if;

  if p_profile_id is not null and not exists (
    select 1 from profiles where id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update games set collector_profile_id = p_profile_id
    where id = p_game_id and deleted_at is null;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
end $$;
revoke all on function set_game_collector(uuid, uuid) from public, anon;
grant execute on function set_game_collector(uuid, uuid) to authenticated;

-- แต่งตั้ง/ถอน แอดมินก๊วน — เฉพาะแอดมินเต็มระบบเท่านั้น
create or replace function set_group_admin(p_profile_id uuid, p_value boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  update profiles set is_group_admin = coalesce(p_value, false)
    where id = p_profile_id;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
end $$;
revoke all on function set_group_admin(uuid, boolean) from public, anon;
grant execute on function set_group_admin(uuid, boolean) to authenticated;
