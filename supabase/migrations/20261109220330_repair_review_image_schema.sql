-- Ensure review uploads have a place to store their public URL and image.
alter table public.product_reviews
  add column if not exists image_url text;

alter table public.product_reviews
  drop constraint if exists product_reviews_image_url_check;

alter table public.product_reviews
  add constraint product_reviews_image_url_check
  check (image_url is null or image_url ~* '^https?://');

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

notify pgrst, 'reload schema';
