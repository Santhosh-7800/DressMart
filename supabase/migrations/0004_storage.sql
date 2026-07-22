-- ============================================================================
-- DressMart — Storage buckets
-- ============================================================================

insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('review-images', 'review-images', true),
  ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "avatar images are publicly accessible" on storage.objects
  for select using (bucket_id = 'avatars');
create policy "users can upload their own avatar" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);
create policy "users can update their own avatar" on storage.objects
  for update using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "review images are publicly accessible" on storage.objects
  for select using (bucket_id = 'review-images');
create policy "users can upload their own review images" on storage.objects
  for insert with check (bucket_id = 'review-images' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "product images are publicly accessible" on storage.objects
  for select using (bucket_id = 'product-images');
create policy "admins can manage product images" on storage.objects
  for all using (bucket_id = 'product-images' and is_admin()) with check (bucket_id = 'product-images' and is_admin());
