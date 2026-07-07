-- ============================================================
-- Basket Bos — Migration 016: จัดการสมาชิกรายก๊วน (แอดมินเพิ่ม/ลบเอง)
--   - แอดมินเต็มระบบ: จัดการได้ทุกก๊วน
--   - แอดมินก๊วน: จัดการสมาชิก (player) ของก๊วนตัวเอง
--   (สมาชิกยังเลือกก๊วนเองตอนสมัครได้เหมือนเดิมผ่าน set_my_groups)
-- ============================================================

-- เพิ่มสมาชิกเข้าก๊วน (เป็น player)
create or replace function add_group_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_group_admin_of(p_group_id) then raise exception 'FORBIDDEN'; end if;
  if not exists (select 1 from profiles where id = p_profile_id) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  insert into group_members (group_id, profile_id, role)
    values (p_group_id, p_profile_id, 'player')
    on conflict (group_id, profile_id) do nothing;
end $$;
revoke all on function add_group_member(uuid, uuid) from public, anon;
grant execute on function add_group_member(uuid, uuid) to authenticated;

-- เอาสมาชิกออกจากก๊วน
--   - แอดมินเต็มระบบ: เอาออกได้ทุกคน (รวมแอดมินก๊วน)
--   - แอดมินก๊วน: เอาออกได้เฉพาะ player (ถอนแอดมินก๊วนคนอื่นไม่ได้)
create or replace function remove_group_member(p_group_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare target_role user_role;
begin
  if not is_group_admin_of(p_group_id) then raise exception 'FORBIDDEN'; end if;

  select role into target_role from group_members
    where group_id = p_group_id and profile_id = p_profile_id;
  if not found then return; end if;

  if target_role = 'admin' and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  delete from group_members
    where group_id = p_group_id and profile_id = p_profile_id;
end $$;
revoke all on function remove_group_member(uuid, uuid) from public, anon;
grant execute on function remove_group_member(uuid, uuid) to authenticated;

-- ลบก๊วน (soft delete) — เฉพาะแอดมินเต็มระบบ
create or replace function delete_group(p_group_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'FORBIDDEN'; end if;
  update groups set deleted_at = now() where id = p_group_id;
  if not found then raise exception 'GROUP_NOT_FOUND'; end if;
end $$;
revoke all on function delete_group(uuid) from public, anon;
grant execute on function delete_group(uuid) to authenticated;
