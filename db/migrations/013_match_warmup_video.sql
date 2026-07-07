-- ============================================================
-- Basket Bos — Migration 013: แมตช์วอร์มอัพ + ลิงก์วิดีโอ (YouTube)
--   - is_warmup: ทำเครื่องหมายว่าแมตช์นี้เป็นวอร์มอัพ (ทีมยังมาไม่ครบ)
--                แต่สถิติ/ผลชนะยังนับตามปกติ
--   - video_url: ลิงก์ YouTube ของแมตช์นั้น ไว้ดูย้อนหลัง
-- ============================================================

alter table matches add column is_warmup boolean not null default false;
alter table matches add column video_url text;
