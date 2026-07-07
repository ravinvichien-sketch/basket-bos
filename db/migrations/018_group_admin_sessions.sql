-- ============================================================
-- Basket Bos — Migration 018: แอดมินก๊วนคุมนัดของก๊วนตัวเองได้เต็มตัว
--   ให้แอดมินก๊วนสร้าง/แก้/เปิด-ปิดนัด, จัดทีม, ตั้งคู่แข่ง, ลบแมตช์
--   ของ "นัดที่อยู่ในก๊วนตัวเอง" ได้ (แอดมินเต็มระบบทำได้ทุกก๊วนเหมือนเดิม)
-- ============================================================

-- helper: caller เป็นแอดมินของก๊วนที่นัด (game) นี้สังกัดไหม
create or replace function is_group_admin_of_game(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from games g
    where g.id = p_game_id
      and (
        is_admin()
        or (g.group_id is not null and is_group_admin_of(g.group_id))
      )
  );
$$;
revoke all on function is_group_admin_of_game(uuid) from public, anon;
grant execute on function is_group_admin_of_game(uuid) to authenticated;

-- helper: caller เป็นแอดมินของก๊วนที่ทีม (team) นี้สังกัดไหม
create or replace function is_group_admin_of_team(p_team_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from teams t where t.id = p_team_id
      and is_group_admin_of_game(t.game_id)
  );
$$;
revoke all on function is_group_admin_of_team(uuid) from public, anon;
grant execute on function is_group_admin_of_team(uuid) to authenticated;

-- games: แอดมินก๊วนจัดการนัดของก๊วนตัวเอง (insert ต้องมี group_id ของก๊วนตัวเอง)
create policy "games_group_admin" on games for all to authenticated
  using (group_id is not null and is_group_admin_of(group_id))
  with check (group_id is not null and is_group_admin_of(group_id));

-- teams / team_members: จัดทีมของนัดในก๊วนตัวเองได้
create policy "teams_group_admin" on teams for all to authenticated
  using (is_group_admin_of_game(game_id))
  with check (is_group_admin_of_game(game_id));

create policy "team_members_group_admin" on team_members for all to authenticated
  using (is_group_admin_of_team(team_id))
  with check (is_group_admin_of_team(team_id));

-- matches: ลบแมตช์ของนัดในก๊วนตัวเองได้ (insert/update เปิดให้สมาชิกอยู่แล้ว)
create policy "matches_delete_group_admin" on matches for delete to authenticated
  using (is_group_admin_of_game(game_id));

-- ============================================================
-- อัปเดต RPC เดิมให้แอดมินก๊วนใช้ได้ด้วย
-- ============================================================

-- admin_add_player v2: แอดมินเต็มระบบ หรือ แอดมินของก๊วนนั้น
create or replace function admin_add_player(p_game_id uuid, p_profile_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  confirmed_count int;
  had_row boolean;
  new_status reg_status;
begin
  select * into g from games where id = p_game_id and deleted_at is null for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  if not (is_admin() or (g.group_id is not null and is_group_admin_of(g.group_id))) then
    raise exception 'FORBIDDEN';
  end if;
  if g.status not in ('open','closed') then raise exception 'REG_CLOSED'; end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = p_profile_id;
  had_row := found;
  if had_row and r.status <> 'cancelled' then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select count(*) into confirmed_count from registrations
    where game_id = p_game_id and status = 'confirmed';
  new_status := case when confirmed_count < g.max_players
                     then 'confirmed'::reg_status
                     else 'waitlisted'::reg_status end;

  if had_row then
    update registrations
      set status = new_status, registered_at = clock_timestamp(),
          cancelled_at = null, promoted_at = null, added_by = auth.uid()
      where id = r.id
      returning * into r;
  else
    insert into registrations (game_id, profile_id, status, added_by)
      values (p_game_id, p_profile_id, new_status, auth.uid())
      returning * into r;
  end if;

  insert into notifications (profile_id, type, channel, payload)
  values (p_profile_id, 'added_by_admin', 'in_app',
          jsonb_build_object('game_id', p_game_id, 'game_title', g.title));

  return r;
end $$;
revoke all on function admin_add_player(uuid, uuid) from public, anon;
grant execute on function admin_add_player(uuid, uuid) to authenticated;

-- cancel_registration v3: อนุญาต "แอดมินของก๊วนนั้น" ให้ถอน/ข้ามเดดไลน์ได้เหมือนแอดมินใหญ่
create or replace function cancel_registration(p_game_id uuid, p_profile_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  nxt registrations%rowtype;
  uid uuid := auth.uid();
  target uuid;
  is_mgr boolean;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  target := coalesce(p_profile_id, uid);
  is_mgr := is_group_admin_of_game(p_game_id);

  select * into g from games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = target
      and status in ('confirmed','waitlisted');
  if not found then raise exception 'NOT_REGISTERED'; end if;

  if target <> uid
     and not is_mgr
     and (r.added_by is null or r.added_by <> uid) then
    raise exception 'FORBIDDEN';
  end if;

  if now() > g.reg_deadline and not is_mgr then
    raise exception 'DEADLINE_PASSED';
  end if;

  update registrations set status = 'cancelled', cancelled_at = now()
    where id = r.id;

  if r.status = 'confirmed' then
    select * into nxt from registrations
      where game_id = p_game_id and status = 'waitlisted'
      order by registered_at asc limit 1;
    if found then
      update registrations set status = 'confirmed', promoted_at = now()
        where id = nxt.id;
      insert into notifications (profile_id, type, channel, payload)
      values (nxt.profile_id, 'promoted', 'in_app',
              jsonb_build_object('game_id', p_game_id, 'game_title', g.title));
    end if;
  end if;
end $$;
