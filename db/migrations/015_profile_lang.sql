-- ============================================================
-- Basket Bos — Migration 015: ภาษาที่ผู้ใช้เลือก (ไทย/อังกฤษ)
-- ============================================================

alter table profiles add column lang text not null default 'th'
  check (lang in ('th', 'en'));
