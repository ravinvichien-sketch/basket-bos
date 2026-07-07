-- ============================================================
-- Basket Bos — Migration 010: ผู้ชวน (ref+อนุมัติ) + คนเก็บเงิน + บัญชีรับเงิน
--   1) registrations.ref_*  — แขกลงชื่อโดยอ้างว่าเป็นเพื่อนของสมาชิกคนไหน
--                             และ "คนที่ถูกอ้าง" ต้องกดอนุมัติเอง
--   2) profiles payout       — คนเก็บเงินใส่ PromptPay/เลขบัญชีของตัวเอง
--   3) games.collector        — แอดมินแต่งตั้งคนเก็บเงินประจำเกม
--   4) is_game_collector()    — ให้คนเก็บเงินจัดการยอดจ่ายของเกมตัวเองได้
-- ============================================================

-- 1) ผู้ชวน + สถานะอนุมัติ บนแถวลงชื่อ ---------------------------
alter table registrations add column ref_profile_id uuid references profiles(id);
alter table registrations add column ref_approved   boolean not null default false;
alter table registrations add column note           text;  -- หมายเหตุเสริม (ถ้ามี)

-- 2) ข้อมูลรับเงินบนโปรไฟล์ (คนเก็บเงินกรอกเอง) ------------------
alter table profiles add column promptpay_id     text;  -- เบอร์ / เลขบัตร ปชช.
alter table profiles add column bank_name        text;  -- เช่น "ไทยพาณิชย์"
alter table profiles add column bank_account_no  text;  -- เลขบัญชี

-- 3) คนเก็บเงินประจำเกม (แอดมินแต่งตั้ง) --------------------------
alter table games add column collector_profile_id uuid references profiles(id);

-- 4) helper + RLS: คนเก็บเงินจัดการ payments ของเกมตัวเองได้ ------
create or replace function is_game_collector(p_game_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from games
    where id = p_game_id and collector_profile_id = auth.uid()
  );
$$;
revoke all on function is_game_collector(uuid) from public, anon;
grant execute on function is_game_collector(uuid) to authenticated;

-- คนเก็บเงินอ่าน/แก้ payments ของเกมที่ตัวเองรับผิดชอบได้ (เหมือนแอดมิน เฉพาะเกมนั้น)
create policy "payments_collector" on payments for all to authenticated
  using (is_game_collector(game_id))
  with check (is_game_collector(game_id));

-- 5) register_guest v2: อ้างผู้ชวน + auto-approve ถ้าเป็นคนพามาเอง --
create or replace function register_guest(
  p_game_id uuid,
  p_profile_id uuid,
  p_ref_profile_id uuid default null,
  p_note text default null
)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  g games%rowtype;
  r registrations%rowtype;
  confirmed_count int;
  waitlist_count int;
  uid uuid := auth.uid();
  new_status reg_status;
  ref_id uuid := p_ref_profile_id;
  approved boolean;
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not exists (
    select 1 from profiles where id = p_profile_id and is_guest
  ) then
    raise exception 'NOT_GUEST';
  end if;

  -- ผู้ชวนต้องเป็นสมาชิกจริง (ไม่ใช่แขก) ; ถ้าไม่ระบุ ให้ถือว่าเป็นคนที่กำลังพามา
  if ref_id is null then ref_id := uid; end if;
  if not exists (
    select 1 from profiles where id = ref_id and not is_guest
  ) then
    raise exception 'REF_NOT_MEMBER';
  end if;
  -- คนพามาเอง = อนุมัติทันที ; อ้างคนอื่น = รอคนนั้นอนุมัติ
  approved := (ref_id = uid);

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

  insert into registrations
      (game_id, profile_id, status, added_by, ref_profile_id, ref_approved, note)
    values
      (p_game_id, p_profile_id, new_status, uid, ref_id, approved,
       nullif(trim(p_note), ''))
    returning * into r;

  -- แจ้งเตือนผู้ชวนให้มากดอนุมัติ (กรณีถูกอ้างโดยคนอื่น)
  if not approved then
    insert into notifications (profile_id, type, channel, payload)
    values (ref_id, 'ref_approval_needed', 'in_app',
            jsonb_build_object('game_id', p_game_id, 'game_title', g.title,
                               'guest_id', p_profile_id, 'registration_id', r.id));
  end if;

  return r;
end $$;

revoke all on function register_guest(uuid, uuid, uuid, text) from public, anon;
grant execute on function register_guest(uuid, uuid, uuid, text) to authenticated;

-- 6) approve_referral: เฉพาะ "คนที่ถูกอ้าง" (หรือแอดมิน) กดอนุมัติได้ --
create or replace function approve_referral(p_registration_id uuid)
returns registrations
language plpgsql security definer set search_path = public as $$
declare
  r registrations%rowtype;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'NOT_AUTHENTICATED'; end if;

  select * into r from registrations where id = p_registration_id for update;
  if not found then raise exception 'NOT_REGISTERED'; end if;
  if r.ref_profile_id is null then raise exception 'NO_REF'; end if;
  if r.ref_profile_id <> uid and not is_admin() then
    raise exception 'FORBIDDEN';
  end if;

  update registrations set ref_approved = true where id = r.id
    returning * into r;
  return r;
end $$;

revoke all on function approve_referral(uuid) from public, anon;
grant execute on function approve_referral(uuid) to authenticated;
