-- Ensure review photos use a public-read bucket while uploads stay scoped to
-- the authenticated customer's own folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-images',
  'review-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Review images are public" on storage.objects;
create policy "Review images are public"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'review-images');

drop policy if exists "Customers upload their own review photo" on storage.objects;
create policy "Customers upload their own review photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'review-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Customers remove their own review photo" on storage.objects;
create policy "Customers remove their own review photo"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'review-images' and owner = auth.uid());
