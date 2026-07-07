-- ============================================================
-- Basket Bos — Migration 008:
--  1) รูป die-cut (ตัดพื้นหลัง) สำหรับการ์ดโปร
--  2) ผลแข่งเก็บชื่อทีมไว้ในตัว — จัดทีมใหม่กลางวัน (4→2) ได้
--     โดยประวัติแมตช์เก่าไม่หาย
-- ============================================================

alter table profiles add column card_photo_cutout_url text;

alter table matches
  add column team_a_name text,
  add column team_b_name text;

-- เติมชื่อทีมให้แมตช์ที่บันทึกไว้แล้ว
update matches m set team_a_name = t.name from teams t
  where m.team_a = t.id and m.team_a_name is null;
update matches m set team_b_name = t.name from teams t
  where m.team_b = t.id and m.team_b_name is null;

-- เปลี่ยน FK: ลบทีม → แมตช์ยังอยู่ (ชื่อทีมถูกเก็บไว้แล้ว)
alter table matches drop constraint if exists matches_team_a_fkey;
alter table matches drop constraint if exists matches_team_b_fkey;
alter table matches alter column team_a drop not null;
alter table matches alter column team_b drop not null;
alter table matches
  add constraint matches_team_a_fkey
    foreign key (team_a) references teams(id) on delete set null;
alter table matches
  add constraint matches_team_b_fkey
    foreign key (team_b) references teams(id) on delete set null;
