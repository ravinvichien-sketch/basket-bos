-- Storage bucket for session summary images (auto-generated, pushed to LINE)
insert into storage.buckets (id, name, public)
values ('summaries', 'summaries', true)
on conflict (id) do nothing;

-- Public read
create policy "summaries_select_public"
on storage.objects for select to public
using (bucket_id = 'summaries');

-- Admin/service_role can manage (handled by server action with admin client)
drop policy if exists "summaries_insert_admin" on storage.objects;
create policy "summaries_insert_admin"
on storage.objects for insert to authenticated
with check (bucket_id = 'summaries');
