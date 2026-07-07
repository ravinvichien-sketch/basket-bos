-- ============================================================
-- Basket Bos — Migration 014: ผู้ใช้เลือกก๊วนของตัวเองได้ (ตอนสมัคร/ภายหลัง)
--   set_my_groups: ตั้งว่าตัวเองอยู่ก๊วนไหนบ้าง (role = 'player')
--     - คงสิทธิ์ 'admin' ของก๊วนไว้เสมอ (ไม่ลบ/ดาวน์เกรด)
--     - จัดการเฉพาะแถวที่เป็น 'player' ของตัวเอง
-- ============================================================

create or replace function set_my_groups(p_group_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- ลบเฉพาะก๊วนที่เป็น player และไม่ได้อยู่ในรายการใหม่
  delete from group_members
    where profile_id = uid
      and role = 'player'
      and not (group_id = any(coalesce(p_group_ids, '{}'::uuid[])));

  -- เพิ่มก๊วนใหม่เป็น player (ถ้ายังไม่มีแถวอยู่ — ถ้าเป็น admin อยู่แล้วไม่แตะ)
  if p_group_ids is not null then
    insert into group_members (group_id, profile_id, role)
      select gid, uid, 'player'
      from unnest(p_group_ids) as gid
      where exists (select 1 from groups g where g.id = gid and g.deleted_at is null)
      on conflict (group_id, profile_id) do nothing;
  end if;
end $$;

revoke all on function set_my_groups(uuid[]) from public, anon;
grant execute on function set_my_groups(uuid[]) to authenticated;
