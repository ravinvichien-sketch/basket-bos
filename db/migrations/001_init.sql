-- ============================================================
-- Basket Bos — Migration 001: full schema, RLS, core functions
-- Run in Supabase SQL Editor or via `supabase db push`
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- Enums ----------
create type user_role as enum ('admin','player');
create type position_t as enum ('PG','SG','SF','PF','C');
create type hand_t as enum ('left','right','both');
create type game_status as enum ('draft','open','closed','in_progress','completed','cancelled');
create type reg_status as enum ('confirmed','waitlisted','cancelled');
create type pay_status as enum ('unpaid','pending','paid','waived');
create type stat_source as enum ('manual','ai','hybrid');
create type video_status as enum ('uploaded','queued','processing','analyzed','failed');
create type job_status as enum ('queued','running','completed','failed');
create type verify_status_t as enum ('pending','accepted','reassigned','rejected');
create type notif_channel as enum ('in_app','line');
create type notif_status as enum ('pending','sent','read','failed');

-- ---------- Tables ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  line_user_id text unique not null,
  role user_role not null default 'player',
  nickname text not null default '',
  real_name text,
  height_cm smallint check (height_cm between 100 and 250),
  weight_kg smallint check (weight_kg between 30 and 200),
  birth_year smallint,
  dominant_hand hand_t not null default 'right',
  skill_rating numeric(3,1) not null default 5.0 check (skill_rating between 1 and 10),
  avatar_url text,
  bio text,
  onboarded boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table player_positions (
  profile_id uuid not null references profiles(id) on delete cascade,
  position position_t not null,
  priority smallint not null check (priority between 1 and 3),
  primary key (profile_id, position),
  unique (profile_id, priority)
);

-- Multi-group readiness (UI stays single-group in Phase 1)
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role user_role not null default 'player',
  primary key (group_id, profile_id)
);

create table games (
  id uuid primary key default gen_random_uuid(),
  group_id uuid references groups(id),
  created_by uuid not null references profiles(id),
  title text not null,
  location text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  court_fee_thb integer not null default 0 check (court_fee_thb >= 0),
  max_players smallint not null check (max_players between 2 and 100),
  reg_opens_at timestamptz not null default now(),
  reg_deadline timestamptz not null,
  status game_status not null default 'draft',
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (reg_deadline <= starts_at)
);

create table registrations (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status reg_status not null,
  registered_at timestamptz not null default clock_timestamp(),
  cancelled_at timestamptz,
  promoted_at timestamptz,
  added_by uuid references profiles(id),
  unique (game_id, profile_id)
);
create index idx_reg_order on registrations (game_id, status, registered_at);

create table teams (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  name text not null,
  color text not null default '#F97316',
  locked boolean not null default false,
  seed integer
);

create table team_members (
  team_id uuid not null references teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  assigned_position position_t,
  primary key (team_id, profile_id)
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  team_a uuid not null references teams(id),
  team_b uuid not null references teams(id),
  score_a smallint not null default 0,
  score_b smallint not null default 0,
  created_at timestamptz not null default now()
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  amount_thb integer not null check (amount_thb >= 0),
  status pay_status not null default 'unpaid',
  qr_payload text,
  slip_url text,
  paid_at timestamptz,
  confirmed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, profile_id)
);

create table videos (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_path text not null,
  duration_s integer,
  size_bytes bigint,
  status video_status not null default 'uploaded',
  created_at timestamptz not null default now()
);

create table ai_analysis_jobs (
  id uuid primary key default gen_random_uuid(),
  video_id uuid not null references videos(id) on delete cascade,
  model_version text,
  status job_status not null default 'queued',
  params jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table ai_events (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references ai_analysis_jobs(id) on delete cascade,
  t_ms integer not null,
  event_type text not null,
  profile_id uuid references profiles(id),
  confidence numeric(4,3),
  payload jsonb not null default '{}'::jsonb,
  verify_status verify_status_t not null default 'pending',
  verified_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index idx_ai_events_job on ai_events (job_id, t_ms);

create table player_game_stats (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  minutes smallint not null default 0,
  points smallint not null default 0,
  fgm smallint not null default 0,
  fga smallint not null default 0,
  tpm smallint not null default 0,
  tpa smallint not null default 0,
  ftm smallint not null default 0,
  fta smallint not null default 0,
  assists smallint not null default 0,
  reb_off smallint not null default 0,
  reb_def smallint not null default 0,
  steals smallint not null default 0,
  blocks smallint not null default 0,
  turnovers smallint not null default 0,
  fouls smallint not null default 0,
  is_mvp boolean not null default false,
  source stat_source not null default 'manual',
  confidence numeric(4,3),
  ai_job_id uuid references ai_analysis_jobs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (game_id, profile_id),
  check (fgm <= fga), check (tpm <= tpa), check (ftm <= fta)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  type text not null,
  channel notif_channel not null default 'in_app',
  payload jsonb not null default '{}'::jsonb,
  status notif_status not null default 'pending',
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_notif_inbox on notifications (profile_id, status, created_at desc);

-- ---------- Helpers & triggers ----------
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;

create or replace function handle_updated_at() returns trigger
language plpgsql as
$$ begin new.updated_at = now(); return new; end $$;

create trigger trg_profiles_updated before update on profiles
  for each row execute function handle_updated_at();
create trigger trg_games_updated before update on games
  for each row execute function handle_updated_at();
create trigger trg_payments_updated before update on payments
  for each row execute function handle_updated_at();
create trigger trg_stats_updated before update on player_game_stats
  for each row execute function handle_updated_at();

-- Players cannot change their own role; skill_rating locked after onboarding
create or replace function protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and coalesce(is_admin(), false) is false
     and auth.uid() is not null then
    raise exception 'ROLE_CHANGE_FORBIDDEN';
  end if;
  if new.skill_rating is distinct from old.skill_rating
     and old.onboarded and auth.uid() = old.id and not is_admin() then
    new.skill_rating = old.skill_rating;
  end if;
  return new;
end $$;

create trigger trg_protect_profile before update on profiles
  for each row execute function protect_profile_fields();

-- ---------- Core queue functions (race-safe FCFS) ----------
create or replace function register_player(p_game_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  confirmed_count int;
  had_row boolean;
  uid uuid := auth.uid();
  new_status reg_status;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  -- Serialize all registration changes per game
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
  new_status := case when confirmed_count < g.max_players
                     then 'confirmed'::reg_status
                     else 'waitlisted'::reg_status end;

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
  if target <> uid and not is_admin() then raise exception 'FORBIDDEN'; end if;

  select * into g from games where id = p_game_id for update;
  if not found then raise exception 'GAME_NOT_FOUND'; end if;
  if now() > g.reg_deadline and not is_admin() then
    raise exception 'DEADLINE_PASSED';
  end if;

  select * into r from registrations
    where game_id = p_game_id and profile_id = target
      and status in ('confirmed','waitlisted');
  if not found then raise exception 'NOT_REGISTERED'; end if;

  update registrations set status = 'cancelled', cancelled_at = now()
    where id = r.id;

  -- Auto-promote the earliest waitlisted player
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

revoke all on function register_player(uuid) from public, anon;
revoke all on function cancel_registration(uuid, uuid) from public, anon;
grant execute on function register_player(uuid) to authenticated;
grant execute on function cancel_registration(uuid, uuid) to authenticated;

-- ---------- Views (security invoker: RLS applies) ----------
create view v_game_counts with (security_invoker = on) as
select g.id as game_id,
  count(r.id) filter (where r.status = 'confirmed') as confirmed_count,
  count(r.id) filter (where r.status = 'waitlisted') as waitlist_count
from games g
left join registrations r on r.game_id = g.id
group by g.id;

create view v_waitlist with (security_invoker = on) as
select r.*,
  row_number() over (partition by r.game_id order by r.registered_at) as waitlist_position
from registrations r
where r.status = 'waitlisted';

create view v_player_season_stats with (security_invoker = on) as
select
  profile_id,
  count(*) as games_played,
  sum(minutes) as total_minutes,
  sum(points) as total_points,
  round(avg(points), 1) as ppg,
  round(avg(assists), 1) as apg,
  round(avg(reb_off + reb_def), 1) as rpg,
  round(avg(steals), 1) as spg,
  round(avg(blocks), 1) as bpg,
  case when sum(fga) > 0 then round(100.0 * sum(fgm) / sum(fga), 1) else null end as fg_pct,
  case when sum(tpa) > 0 then round(100.0 * sum(tpm) / sum(tpa), 1) else null end as tp_pct,
  case when sum(fta) > 0 then round(100.0 * sum(ftm) / sum(fta), 1) else null end as ft_pct,
  count(*) filter (where is_mvp) as mvp_count
from player_game_stats
group by profile_id;

create view v_game_payment_summary with (security_invoker = on) as
select game_id,
  count(*) filter (where status = 'paid') as paid_count,
  count(*) filter (where status = 'pending') as pending_count,
  count(*) filter (where status = 'unpaid') as unpaid_count,
  coalesce(sum(amount_thb) filter (where status = 'paid'), 0) as collected_thb,
  coalesce(sum(amount_thb) filter (where status <> 'waived'), 0) as total_thb
from payments
group by game_id;

-- ---------- Row Level Security ----------
alter table profiles enable row level security;
alter table player_positions enable row level security;
alter table groups enable row level security;
alter table group_members enable row level security;
alter table games enable row level security;
alter table registrations enable row level security;
alter table teams enable row level security;
alter table team_members enable row level security;
alter table matches enable row level security;
alter table payments enable row level security;
alter table player_game_stats enable row level security;
alter table videos enable row level security;
alter table ai_analysis_jobs enable row level security;
alter table ai_events enable row level security;
alter table notifications enable row level security;

-- profiles: everyone in the community can see each other; only self-update
create policy "profiles_select" on profiles for select to authenticated using (true);
create policy "profiles_update_self" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
create policy "profiles_update_admin" on profiles for update to authenticated
  using (is_admin()) with check (is_admin());

-- player_positions: readable by all, self-managed
create policy "positions_select" on player_positions for select to authenticated using (true);
create policy "positions_write_self" on player_positions for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- groups (Phase 1: read-only surface)
create policy "groups_select" on groups for select to authenticated using (true);
create policy "groups_admin" on groups for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "group_members_select" on group_members for select to authenticated using (true);
create policy "group_members_admin" on group_members for all to authenticated
  using (is_admin()) with check (is_admin());

-- games: everyone reads, admin writes
create policy "games_select" on games for select to authenticated using (deleted_at is null or is_admin());
create policy "games_admin" on games for all to authenticated
  using (is_admin()) with check (is_admin());

-- registrations: read for all; writes ONLY via register_player/cancel_registration
create policy "registrations_select" on registrations for select to authenticated using (true);

-- teams & matches: read all, admin writes
create policy "teams_select" on teams for select to authenticated using (true);
create policy "teams_admin" on teams for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "team_members_select" on team_members for select to authenticated using (true);
create policy "team_members_admin" on team_members for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "matches_select" on matches for select to authenticated using (true);
create policy "matches_admin" on matches for all to authenticated
  using (is_admin()) with check (is_admin());

-- payments: player sees & updates own (mark pending + slip); admin everything
create policy "payments_select_own" on payments for select to authenticated
  using (profile_id = auth.uid() or is_admin());
create policy "payments_update_own" on payments for update to authenticated
  using (profile_id = auth.uid() and status in ('unpaid','pending'))
  with check (profile_id = auth.uid() and status in ('unpaid','pending'));
create policy "payments_admin" on payments for all to authenticated
  using (is_admin()) with check (is_admin());

-- stats: read all, admin writes
create policy "stats_select" on player_game_stats for select to authenticated using (true);
create policy "stats_admin" on player_game_stats for all to authenticated
  using (is_admin()) with check (is_admin());

-- videos: read all, admin writes
create policy "videos_select" on videos for select to authenticated using (true);
create policy "videos_admin" on videos for all to authenticated
  using (is_admin()) with check (is_admin());

-- AI tables: admin only (worker uses service role which bypasses RLS)
create policy "ai_jobs_admin" on ai_analysis_jobs for all to authenticated
  using (is_admin()) with check (is_admin());
create policy "ai_events_admin" on ai_events for all to authenticated
  using (is_admin()) with check (is_admin());

-- notifications: own inbox; mark-as-read only
create policy "notifications_select_own" on notifications for select to authenticated
  using (profile_id = auth.uid());
create policy "notifications_update_own" on notifications for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- ---------- Storage buckets ----------
insert into storage.buckets (id, name, public) values ('avatars','avatars', true)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('slips','slips', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('videos','videos', false)
  on conflict (id) do nothing;

create policy "avatars_read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars');
create policy "avatars_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "slips_read" on storage.objects for select to authenticated
  using (bucket_id = 'slips' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));
create policy "slips_write_own" on storage.objects for insert to authenticated
  with check (bucket_id = 'slips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "videos_read" on storage.objects for select to authenticated
  using (bucket_id = 'videos');
create policy "videos_write_admin" on storage.objects for insert to authenticated
  with check (bucket_id = 'videos' and is_admin());
