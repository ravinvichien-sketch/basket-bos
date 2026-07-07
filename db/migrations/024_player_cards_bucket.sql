-- Storage bucket for shareable player card images
insert into storage.buckets (id, name, public)
values ('player_cards', 'player_cards', true)
on conflict (id) do nothing;

-- Public read
create policy "player_cards_select_public"
on storage.objects for select to public
using (bucket_id = 'player_cards');

-- Admin/service_role can manage (handled by api/upload-card route with admin client)
