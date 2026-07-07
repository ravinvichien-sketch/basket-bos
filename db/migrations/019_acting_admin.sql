-- ============================================================
-- Basket Bos — Migration 019: มอบสิทธิ์คุมนัดชั่วคราว (acting admin)
--   แอดมินก๊วนโอนสิทธิ์คุม "เฉพาะนัดนี้" ให้คนอื่นได้ เผื่อตัวเองไม่ว่าง
--   ผูกกับนัด (game) เดียว → นัดใหม่เริ่มที่ค่า default (ไม่มี acting)
--   = กลับมาเป็นแอดมินก๊วนคนเดิมโดยอัตโนมัติ
-- ============================================================

alter table games add column acting_admin_id uuid references profiles(id);

-- ให้ acting admin ของนัดนั้น นับเป็น "แอดมินของนัด" ด้วย
create or replace function is_group_admin_of_game(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from games g
    where g.id = p_game_id
      and (
        is_admin()
        or (g.group_id is not null and is_group_admin_of(g.group_id))
        or g.acting_admin_id = auth.uid()
      )
  );
$$;

-- มอบ/คืนสิทธิ์คุมนัด (ปล่อยว่าง = คืน) — ทำได้เฉพาะแอดมิน "ตัวจริง" ของนัด
--   (แอดมินเต็มระบบ หรือ แอดมินก๊วนของนัดนั้น) — acting admin โอนต่อไม่ได้
create or replace function set_acting_admin(p_game_id uuid, p_profile_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from games where id = p_game_id and deleted_at is null;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if not (is_admin() or (gid is not null and is_group_admin_of(gid))) then
    raise exception 'FORBIDDEN';
  end if;

  if p_profile_id is not null and not exists (
    select 1 from profiles where id = p_profile_id
  ) then
    raise exception 'PROFILE_NOT_FOUND';
  end if;

  update games set acting_admin_id = p_profile_id where id = p_game_id;
end $$;
revoke all on function set_acting_admin(uuid, uuid) from public, anon;
grant execute on function set_acting_admin(uuid, uuid) to authenticated;
