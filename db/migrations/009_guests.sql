-- ============================================================
-- Basket Bos — Migration 009: ระบบแขก (ลงชื่อแทนเพื่อนที่ไม่มีบัญชี)
--  - สมาชิกทุกคนพาเพื่อน (guest) มาลงชื่อได้ นับคิว/หารเงินตามปกติ
--  - คนที่พามาสามารถถอนชื่อแขกของตัวเองได้เอง
-- ============================================================

alter table profiles add column is_guest boolean not null default false;

-- ลงชื่อแทนแขก (เฉพาะโปรไฟล์ที่เป็น guest เท่านั้น กันเอาไปลงแทนสมาชิกจริง)
create or replace function register_guest(p_game_id uuid, p_profile_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  confirmed_count int;
  waitlist_count int;
  uid uuid := auth.uid();
  new_status reg_status;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (
    select 1 from profiles where id = p_profile_id and is_guest
  ) then
    raise exception 'NOT_GUEST';
  end if;

  select * into g from games where id = p_game_id and deleted_at is null for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status <> 'open' or now() < g.reg_opens_at or now() > g.reg_deadline then
    raise exception 'REG_CLOSED';
  end if;

  if exists (
    select 1 from registrations
    where game_id = p_game_id and profile_id = p_profile_id
      and status <> 'cancelled'
  ) then
    raise exception 'ALREADY_REGISTERED';
  end if;

  select count(*) into confirmed_count from registrations
    where game_id = p_game_id and status = 'confirmed';
  if confirmed_count < g.max_players then
    new_status := 'confirmed';
  else
    select count(*) into waitlist_count from registrations
      where game_id = p_game_id and status = 'waitlisted';
    if waitlist_count >= g.max_waitlist then
      raise exception 'WAITLIST_FULL';
    end if;
    new_status := 'waitlisted';
  end if;

  insert into registrations (game_id, profile_id, status, added_by)
    values (p_game_id, p_profile_id, new_status, uid)
    returning * into r;
  return r;
end $$;

revoke all on function register_guest(uuid, uuid) from public, anon;
grant execute on function register_guest(uuid, uuid) to authenticated;

-- cancel_registration v2: อนุญาตให้ "คนที่พามา" (added_by) ถอนชื่อแขกได้ด้วย
create or replace function cancel_registration(p_game_id uuid, p_profile_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  nxt registrations%rowtype;
  uid uuid := auth.uid();
  target uuid;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  target := coalesce(p_profile_id, uid);

  select * into g from games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = target
      and status in ('confirmed','waitlisted');
  if not found then raise exception 'NOT_REGISTERED'; end if;

  if target <> uid
     and not is_admin()
     and (r.added_by is null or r.added_by <> uid) then
    raise exception 'FORBIDDEN';
  end if;

  if now() > g.reg_deadline and not is_admin() then
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
