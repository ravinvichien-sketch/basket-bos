-- ============================================================
-- Migration 047: User AI settings (provider + custom API key)
-- ============================================================

create table if not exists user_ai_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  provider text not null default 'default' check (provider in ('default', 'groq', 'gemini', 'openai', 'anthropic')),
  api_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table user_ai_settings enable row level security;

create policy "uai_select" on user_ai_settings for select to authenticated
  using (profile_id = auth.uid());

create policy "uai_insert" on user_ai_settings for insert to authenticated
  with check (profile_id = auth.uid());

create policy "uai_update" on user_ai_settings for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
