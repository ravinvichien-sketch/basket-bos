-- ============================================================
-- Basket Bos — Migration 020: คีย์สถิติตัวเองย้อนหลัง (รออนุมัติ)
--   นักกีฬาส่งสถิติของตัวเองย้อนหลังได้ แต่ต้องให้แอดมินก๊วน/แอดมินระบบ
--   "อนุมัติ" ก่อน ถึงจะบวกเข้าสถิติจริง (กันคนใส่ตัวเลขมั่ว)
-- ============================================================

create table stat_submissions (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  points smallint not null default 0 check (points between 0 and 200),
  rebounds smallint not null default 0 check (rebounds between 0 and 100),
  assists smallint not null default 0 check (assists between 0 and 100),
  steals smallint not null default 0 check (steals between 0 and 100),
  blocks smallint not null default 0 check (blocks between 0 and 100),
  turnovers smallint not null default 0 check (turnovers between 0 and 100),
  note text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_stat_sub_game on stat_submissions (game_id, status);

alter table stat_submissions enable row level security;
-- เจ้าของ + แอดมินของนัดนั้น อ่านได้
create policy "stat_sub_select" on stat_submissions for select to authenticated
  using (profile_id = auth.uid() or is_group_admin_of_game(game_id));
alter publication supabase_realtime add table stat_submissions;

-- นักกีฬาส่งสถิติของตัวเอง (สถานะ pending)
create or replace function submit_own_stats(
  p_game_id uuid,
  p_points int, p_rebounds int, p_assists int,
  p_steals int, p_blocks int, p_turnovers int,
  p_note text default null
)
returns stat_submissions
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); r stat_submissions%rowtype;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (select 1 from games where id = p_game_id and deleted_at is null) then
    raise exception 'GAME_NOT_FOUND';
  end if;

  insert into stat_submissions
    (game_id, profile_id, points, rebounds, assists, steals, blocks, turnovers, note)
  values
    (p_game_id, uid,
     greatest(0, coalesce(p_points,0)), greatest(0, coalesce(p_rebounds,0)),
     greatest(0, coalesce(p_assists,0)), greatest(0, coalesce(p_steals,0)),
     greatest(0, coalesce(p_blocks,0)), greatest(0, coalesce(p_turnovers,0)),
     nullif(trim(p_note), ''))
  returning * into r;

  -- แจ้งเตือนแอดมินของนัด (best-effort ผ่าน in_app ให้คนที่เป็นแอดมินก๊วน)
  return r;
end $$;
revoke all on function submit_own_stats(uuid,int,int,int,int,int,int,text) from public, anon;
grant execute on function submit_own_stats(uuid,int,int,int,int,int,int,text) to authenticated;

-- แอดมินของนัด (ก๊วน/ระบบ) อนุมัติหรือปฏิเสธ
--   อนุมัติ = บวกตัวเลขเข้ากับสถิติจริงของคนนั้นในนัดนั้น
create or replace function review_stat_submission(p_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare s stat_submissions%rowtype; uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  select * into s from stat_submissions where id = p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not is_group_admin_of_game(s.game_id) then raise exception 'FORBIDDEN'; end if;
  if s.status <> 'pending' then raise exception 'ALREADY_REVIEWED'; end if;

  if p_approve then
    insert into player_game_stats
      (game_id, profile_id, points, reb_def, assists, steals, blocks, turnovers, source)
    values
      (s.game_id, s.profile_id, s.points, s.rebounds, s.assists,
       s.steals, s.blocks, s.turnovers, 'manual')
    on conflict (game_id, profile_id) do update set
      points     = player_game_stats.points     + excluded.points,
      reb_def    = player_game_stats.reb_def    + excluded.reb_def,
      assists    = player_game_stats.assists    + excluded.assists,
      steals     = player_game_stats.steals     + excluded.steals,
      blocks     = player_game_stats.blocks     + excluded.blocks,
      turnovers  = player_game_stats.turnovers  + excluded.turnovers,
      updated_at = now();
  end if;

  update stat_submissions
    set status = case when p_approve then 'approved' else 'rejected' end,
        reviewed_by = uid, reviewed_at = now()
    where id = p_id;
end $$;
revoke all on function review_stat_submission(uuid, boolean) from public, anon;
grant execute on function review_stat_submission(uuid, boolean) to authenticated;
