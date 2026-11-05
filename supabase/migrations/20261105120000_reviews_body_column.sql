-- Align `product_reviews` with the review text column the application writes.
--
-- The first deployed version of this table named the review text `comment`; the
-- migrations in this repo (and therefore the storefront, the admin queue and the
-- device-queue drain) use `body`. On a project where `body` is missing, every
-- review read and write fails with 42703 ("column product_reviews.body does not
-- exist"), which the app can only work around by storing reviews on the device.
--
-- This migration renames in place, so existing rows are preserved, and is safe to
-- run on a project that already has `body` (it does nothing there).

do $$
begin
  -- Only rename when the old name exists and the new one does not.
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'comment'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'body'
  ) then
    alter table public.product_reviews rename column comment to body;
  end if;

  -- A project missing both columns gets the default shape back.
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'body'
  ) then
    alter table public.product_reviews add column body text not null default '';
  end if;
end $$;

-- PostgREST caches the row shape; without this the rename only takes effect after
-- the next schema reload and the API keeps answering 42703.
notify pgrst, 'reload schema';

comment on column public.product_reviews.body is
  'Review text as written by the customer (renamed from `comment` on 2026-11-05).';
