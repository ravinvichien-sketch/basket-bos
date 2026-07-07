-- ============================================================
-- Basket Bos — Migration 012: หลายก๊วน (multi-group) + แอดมินก๊วนแยกก๊วน
--   - แอดมินเต็มระบบสร้างก๊วนได้เรื่อย ๆ + แต่งตั้งแอดมินของแต่ละก๊วน
--   - ตั้งเกมต้องเลือกก๊วน
--   - แอดมินก๊วนคุมได้เฉพาะก๊วนตัวเอง (แต่งตั้งคนเก็บเงินของเกมในก๊วนนั้น)
--
--   หมายเหตุ: แทนที่สิทธิ์ global is_group_admin (migration 011)
--             ด้วยสิทธิ์รายก๊วนผ่าน group_members.role = 'admin'
-- ============================================================

alter table groups add column created_by uuid references profiles(id);
alter table groups add column deleted_at timestamptz;

-- caller เป็นแอดมินของก๊วนนี้ไหม (แอดมินเต็มระบบนับด้วยเสมอ)
create or replace function is_group_admin_of(p_group_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select is_admin() or exists (
    select 1 from group_members
    where group_id = p_group_id
      and profile_id = auth.uid()
      and role = 'admin'
  );
$$;
revoke all on function is_group_admin_of(uuid) from public, anon;
grant execute on function is_group_admin_of(uuid) to authenticated;

-- แต่งตั้งคนเก็บเงิน: ตรวจสิทธิ์ตามก๊วนของเกม
create or replace function set_game_collector(p_game_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from games
    where id = p_game_id and deleted_at is null;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  -- เกมที่ยังไม่ผูกก๊วน (ข้อมูลเก่า) → เฉพาะแอดมินเต็มระบบ
  if gid is null then
    if not is_admin() then raise exception 'FORBIDDEN'; end if;
  else
    if not is_group_admin_of(gid) then raise exception 'FORBIDDEN'; end if;
  end if;

  if p_profile_id is not null and not exists (
    select 1 from profiles where id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update games set collector_profile_id = p_profile_id where id = p_game_id;
end $$;
revoke all on function set_game_collector(uuid, uuid) from public, anon;
grant execute on function set_game_collector(uuid, uuid) to authenticated;

-- สร้างก๊วนใหม่ (แอดมินเต็มระบบ)
create or replace function create_group(p_name text)
returns groups
language plpgsql security definer set search_path = public as $$
declare g groups%rowtype;
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  insert into groups (name, created_by)
    values (trim(p_name), auth.uid())
    returning * into g;
  return g;
end $$;
revoke all on function create_group(text) from public, anon;
grant execute on function create_group(text) to authenticated;

-- เปลี่ยนชื่อก๊วน (แอดมินเต็มระบบ)
create or replace function rename_group(p_group_id uuid, p_name text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  update groups set name = trim(p_name) where id = p_group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
end $$;
revoke all on function rename_group(uuid, text) from public, anon;
grant execute on function rename_group(uuid, text) to authenticated;

-- แต่งตั้ง/ถอน แอดมินของก๊วน (แอดมินเต็มระบบ)
create or replace function set_group_member_admin(
  p_group_id uuid, p_profile_id uuid, p_value boolean
)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

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
