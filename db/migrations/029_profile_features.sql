-- Profile comments + LINE ID + Dream Team

-- 1. Comments on profiles
create table profile_comments (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references profiles(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table profile_comments enable row level security;

create policy "profile_comments_select"
  on profile_comments for select to authenticated using (true);

create policy "profile_comments_insert"
  on profile_comments for insert to authenticated
  with check (author_id = auth.uid());

create policy "profile_comments_delete"
  on profile_comments for delete to authenticated
  using (author_id = auth.uid());

-- 2. Public LINE ID for add-friend button
alter table profiles add column line_id text;

-- 3. Dream Team (mutual consent)
create table dream_team_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (requester_id, target_id)
);

alter table dream_team_requests enable row level security;

create policy "dream_team_select"
  on dream_team_requests for select to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

create policy "dream_team_insert"
  on dream_team_requests for insert to authenticated
  with check (requester_id = auth.uid());

create policy "dream_team_update"
  on dream_team_requests for update to authenticated
  using (target_id = auth.uid())
  with check (target_id = auth.uid() and status in ('accepted', 'rejected'));

create policy "dream_team_delete"
  on dream_team_requests for delete to authenticated
  using (requester_id = auth.uid());
