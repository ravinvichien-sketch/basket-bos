-- ============================================================
-- Basket Bos — Migration 002: admin force-add + realtime
-- ============================================================

-- Admin can add any member to a game (bypasses reg window, not capacity)
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
  if not is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into g from games where id = p_game_id and deleted_at is null for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
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

-- Live queue updates in the app
alter publication supabase_realtime add table registrations;
