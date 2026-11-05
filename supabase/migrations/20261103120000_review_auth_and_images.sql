-- Customer reviews: author identity, a product photograph, and sign-in required.
--
-- 1. `product_reviews.user_id` ties a review to the auth user who wrote it, so
--    the storefront credits the account instead of a free-text name the customer
--    could type as anything.
-- 2. `product_reviews.image_url` holds the public URL of the photo the customer
--    uploaded to the `review-images` bucket.
-- 3. Writing a review now requires an authenticated customer: the old anon
--    insert policy is replaced by one that demands the row belong to its author.
-- 4. The `review-images` bucket is created here so a fresh environment needs no
--    dashboard clicks: public read (the URL is embedded in a published review),
--    authenticated upload confined to the uploader's own folder.

alter table public.product_reviews
  add column if not exists user_id uuid references auth.users (id) on delete set null,
  add column if not exists image_url text;

-- A review photo is always a URL, never a data: payload stored in the row.
alter table public.product_reviews
  drop constraint if exists product_reviews_image_url_check;
alter table public.product_reviews
  add constraint product_reviews_image_url_check
  check (image_url is null or image_url ~* '^https?://');

create index if not exists product_reviews_user_idx
  on public.product_reviews (user_id)
  where user_id is not null;

-- Sign-in is mandatory ------------------------------------------------------
-- `with check` pins the row to the author, so a signed-in customer cannot write
-- a review in someone else's name.
drop policy if exists "Anyone can write a review" on public.product_reviews;
drop policy if exists "Signed-in customers write their own review" on public.product_reviews;
create policy "Signed-in customers write their own review"
  on public.product_reviews for insert
  to authenticated
  with check (status = 'pending' and user_id = auth.uid());

-- Review photos ------------------------------------------------------------
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

-- The client uploads to `<user-id>/<uuid>.<ext>`; the first path segment must be
-- the caller's own id, so one customer cannot overwrite another's photo.
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

comment on column public.product_reviews.user_id is
  'Auth user who wrote the review; null only for rows imported before sign-in was required.';
comment on column public.product_reviews.image_url is
  'Public URL of the customer photo in the review-images bucket.';
