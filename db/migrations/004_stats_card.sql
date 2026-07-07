-- ============================================================
-- Basket Bos — Migration 004: waitlist cap + card photo
-- Defaults per group policy: 20 players / 5 waitlist / 4 teams
-- ============================================================

alter table games add column max_waitlist smallint not null default 5
  check (max_waitlist between 0 and 50);

alter table profiles add column card_photo_url text;

-- register_player now enforces the waitlist cap
create or replace function register_player(p_game_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  confirmed_count int;
  waitlist_count int;
  had_row boolean;
  uid uuid := auth.uid();
  new_status reg_status;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into g from games where id = p_game_id and deleted_at is null for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if g.status <> 'open' or now() < g.reg_opens_at or now() > g.reg_deadline then
    raise exception 'REG_CLOSED';
  end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = uid;
  had_row := found;
  if had_row and r.status <> 'cancelled' then
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

  if had_row then
    update registrations
      set status = new_status, registered_at = clock_timestamp(),
          cancelled_at = null, promoted_at = null
      where id = r.id
      returning * into r;
  else
    insert into registrations (game_id, profile_id, status)
      values (p_game_id, uid, new_status)
      returning * into r;
  end if;

  return r;
end $$;
