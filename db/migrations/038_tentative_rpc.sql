-- RPC for registering as "tentative" (ไม่แน่นอน) — bypasses FCFS/waitlist
-- Direct upsert from client fails due to RLS; this is security definer.

-- Google Drive link column for game photos
alter table game_photos add column drive_url text;

create or replace function register_tentative(p_game_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  r registrations%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = uid;

  if found and r.status = 'cancelled' then
    -- Re-register from cancelled → tentative
    update registrations
      set status = 'tentative'::reg_status, registered_at = clock_timestamp(),
          cancelled_at = null, promoted_at = null
      where id = r.id
      returning * into r;
  elsif found then
    -- Already registered (non-cancelled)
    raise exception 'ALREADY_REGISTERED';
  else
    insert into registrations (game_id, profile_id, status)
      values (p_game_id, uid, 'tentative'::reg_status)
      returning * into r;
  end if;

  return r;
end $$;

-- Also patch cancel_registration to allow cancelling tentative registrations
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
      and status in ('confirmed','waitlisted','tentative');
  if not found then raise exception 'NOT_REGISTERED'; end if;

  if target <> uid
     and not is_mgr
     and (r.added_by is null or r.added_by <> uid) then
    raise exception 'FORBIDDEN';
  end if;

  -- Tentative can be cancelled anytime; confirmed/waitlisted respects deadline
  if r.status <> 'tentative' and now() > g.reg_deadline and not is_mgr then
    raise exception 'DEADLINE_PASSED';
  end if;

  update registrations set status = 'cancelled', cancelled_at = now()
    where id = r.id;

  -- Auto-promote the earliest waitlisted player (only when a confirmed spot opens)
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
