-- ============================================================
-- Basket Bos — Migration 017: ลบนัด (session/game) ได้อิสระ
--   - แอดมินเต็มระบบ หรือ แอดมินของก๊วนที่นัดนั้นสังกัด ลบได้ทุกสถานะ
--   - เป็น soft delete (ประวัติสถิติ/จ่ายเงินไม่หาย แค่ซ่อนจาก UI)
-- ============================================================

create or replace function delete_game_session(p_game_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  select group_id into gid from games where id = p_game_id;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if gid is null then
    if not is_admin() then raise exception 'FORBIDDEN'; end if;
  else
    if not is_group_admin_of(gid) then raise exception 'FORBIDDEN'; end if;
  end if;

  update games set deleted_at = now() where id = p_game_id;
end $$;
revoke all on function delete_game_session(uuid) from public, anon;
grant execute on function delete_game_session(uuid) to authenticated;
