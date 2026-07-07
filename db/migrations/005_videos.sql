-- ============================================================
-- Basket Bos — Migration 005: video management policies
-- ============================================================

create policy "videos_delete_admin" on storage.objects for delete to authenticated
  using (bucket_id = 'videos' and is_admin());

create policy "avatars_delete_own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
