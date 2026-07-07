-- ============================================================
-- Basket Bos — Migration 006: fee mode (split total / fixed per person)
-- ============================================================

create type fee_mode_t as enum ('split','fixed');

-- split = court_fee_thb คือค่าสนามรวม แล้วหารตามจำนวนคน
-- fixed = court_fee_thb คือราคาต่อคน ทุกคนจ่ายเท่ากัน
alter table games add column fee_mode fee_mode_t not null default 'split';
