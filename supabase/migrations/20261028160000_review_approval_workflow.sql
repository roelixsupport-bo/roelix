-- Review approval workflow.
--
-- A storefront review is no longer live the moment it is written: it lands as
-- `pending`, appears in the admin queue, and only becomes publicly readable once
-- an admin approves it. Deleting is the other admin action.
--
-- Statuses:
--   pending    written by a customer, visible to admins only
--   published  approved, readable by everyone
--   hidden     was approved, pulled from the storefront without losing the row
--
-- The public read policy already limits anon/authenticated to `status = 'published'`,
-- so a pending row is invisible to the storefront the moment this is applied.

alter table public.product_reviews
  alter column status set default 'pending';

-- The original check only knew about published/hidden.
alter table public.product_reviews
  drop constraint if exists product_reviews_status_check;

alter table public.product_reviews
  add constraint product_reviews_status_check
  check (status in ('pending', 'published', 'hidden'));

-- A customer may only ever create a pending review. Approving is an admin act,
-- enforced here as well as in the RLS update policy.
drop policy if exists "Anyone can write a review" on public.product_reviews;
create policy "Anyone can write a review"
  on public.product_reviews for insert
  to anon, authenticated
  with check (status = 'pending');

-- Keep the moderation queue cheap to load, however many approved reviews pile up.
create index if not exists product_reviews_pending_idx
  on public.product_reviews (created_at desc)
  where status = 'pending';

comment on column public.product_reviews.status is
  'pending = awaiting approval, published = live on the storefront, hidden = withdrawn from the storefront';
