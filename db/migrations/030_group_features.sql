-- Group location
alter table groups add column location text;
alter table groups add column lat double precision;
alter table groups add column lng double precision;

-- Group join requests (request to join a group)
create table group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  requester_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references profiles(id),
  unique (group_id, requester_id)
);

alter table group_join_requests enable row level security;

create policy "gjreq_select" on group_join_requests for select to authenticated
  using (
    requester_id = auth.uid() or
    exists (
      select 1 from group_members
      where group_id = group_join_requests.group_id
        and profile_id = auth.uid()
        and role = 'admin'
    ) or
    is_admin()
  );

create policy "gjreq_insert" on group_join_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy "gjreq_update" on group_join_requests for update to authenticated
  using (
    exists (
      select 1 from group_members
      where group_id = group_join_requests.group_id
        and profile_id = auth.uid()
        and role = 'admin'
    ) or
    is_admin()
  );

-- Dream Teams: named teams with up to 15 members, max 3 per person
create table dream_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table dream_team_members (
  id uuid primary key default gen_random_uuid(),
  dream_team_id uuid not null references dream_teams(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (dream_team_id, profile_id)
);

alter table dream_teams enable row level security;
alter table dream_team_members enable row level security;

create policy "dt_select" on dream_teams for select to authenticated using (true);
create policy "dt_insert" on dream_teams for insert to authenticated with check (owner_id = auth.uid());
create policy "dt_update" on dream_teams for update to authenticated using (owner_id = auth.uid());
create policy "dt_delete" on dream_teams for delete to authenticated using (owner_id = auth.uid());

create policy "dtm_select" on dream_team_members for select to authenticated
  using (
    profile_id = auth.uid() or
    exists (select 1 from dream_teams where id = dream_team_members.dream_team_id and owner_id = auth.uid())
  );

create policy "dtm_insert" on dream_team_members for insert to authenticated
  with check (
    exists (select 1 from dream_teams where id = dream_team_members.dream_team_id and owner_id = auth.uid())
  );

create policy "dtm_update" on dream_team_members for update to authenticated
  using (
    profile_id = auth.uid()
  )
  with check (
    profile_id = auth.uid() and status in ('accepted', 'rejected')
  );

-- Drop old dream_team_requests table and replace with new system
drop table if exists dream_team_requests cascade;

-- Game notes (per-group custom rules)
alter table games add column notes text;
