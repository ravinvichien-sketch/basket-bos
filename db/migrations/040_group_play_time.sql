-- ============================================================
-- Migration 040: Group play time settings
--   - แต่ละก๊วนสามารถตั้งค่าเวลาเริ่ม-เลิกเล่นประจำได้
--   - เวลานี้จะเป็น default ตอนสร้าง Session ใหม่
-- ============================================================

alter table groups add column play_start_time time;
alter table groups add column play_end_time time;

-- อัปเดต create_group RPC — เพิ่มพารามิเตอร์เวลาเล่น
drop function if exists create_group(text, text);

create or replace function create_group(
  p_name text,
  p_line_group_id text,
  p_play_start_time time default null,
  p_play_end_time time default null
)
returns groups
language plpgsql security definer set search_path = public as $$
declare
  g groups%rowtype;
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'EMPTY_NAME'; end if;
  if coalesce(trim(p_line_group_id), '') = '' then raise exception 'NO_LINE_GROUP'; end if;

  if not exists (select 1 from profiles where id = auth.uid() and onboarded = true) then
    raise exception 'NOT_ONBOARDED';
  end if;

  insert into groups (name, line_group_id, created_by, play_start_time, play_end_time)
    values (trim(p_name), trim(p_line_group_id), auth.uid(), p_play_start_time, p_play_end_time)
    returning * into g;

  insert into group_members (group_id, profile_id, role)
    values (g.id, auth.uid(), 'admin');

  return g;
end $$;
revoke all on function create_group(text, text, time, time) from public, anon;
grant execute on function create_group(text, text, time, time) to authenticated;
