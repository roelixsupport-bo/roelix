insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Product images are public" on storage.objects;
create policy "Product images are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

drop policy if exists "Anon can upload product images" on storage.objects;
create policy "Anon can upload product images"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'product-images');

drop policy if exists "Anon can update product images" on storage.objects;
create policy "Anon can update product images"
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'product-images')
  with check (bucket_id = 'product-images');

drop policy if exists "Anon can delete product images" on storage.objects;
create policy "Anon can delete product images"
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'product-images');

notify pgrst, 'reload schema';