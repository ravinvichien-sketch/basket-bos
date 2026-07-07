-- Photo gallery for game sessions
create table game_photos (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references games(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now()
);

alter table game_photos enable row level security;

-- Authenticated users can view photos
create policy "game_photos_select"
on game_photos for select to authenticated
using (true);

-- Authenticated users can upload photos
create policy "game_photos_insert"
on game_photos for insert to authenticated
with check (true);

-- Only the uploader or admin can delete
create policy "game_photos_delete_own"
on game_photos for delete to authenticated
using (
  uploaded_by = auth.uid()
  or exists (select 1 from profiles where id = auth.uid() and role = 'admin')
);

-- Storage bucket for game photos
insert into storage.buckets (id, name, public)
values ('game_photos', 'game_photos', true)
on conflict (id) do nothing;

create policy "game_photos_storage_select"
on storage.objects for select to public
using (bucket_id = 'game_photos');

create policy "game_photos_storage_insert"
on storage.objects for insert to authenticated
with check (bucket_id = 'game_photos');
