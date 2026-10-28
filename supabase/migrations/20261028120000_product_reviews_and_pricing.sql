-- Product-level pricing defaults and customer reviews.
--
-- 1. `products.sku` / `products.compare_at_price` let a product advertise a SKU
--    and a "was" price before any variant matrix exists. Variants still win when
--    present: the PDP and admin both prefer the variant values.
-- 2. `product_reviews` stores storefront ratings. Reviews are readable by
--    everyone, insertable by anyone (public storefront), and only moderatable by
--    an admin, so a hidden review cannot be flipped back by a customer.

alter table if exists public.products
  add column if not exists sku text,
  add column if not exists compare_at_price numeric(10, 2)
    check (compare_at_price is null or compare_at_price >= 0);

create table if not exists public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  author_name text not null check (char_length(btrim(author_name)) between 2 and 60),
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 4 and 2000),
  status text not null default 'published' check (status in ('published', 'hidden')),
  created_at timestamptz not null default now()
);

create index if not exists product_reviews_product_id_idx
  on public.product_reviews (product_id, created_at desc);

alter table public.product_reviews enable row level security;

grant select on public.product_reviews to anon, authenticated;
grant insert on public.product_reviews to anon, authenticated;
grant update, delete on public.product_reviews to authenticated;

drop policy if exists "Anyone can read published reviews" on public.product_reviews;
drop policy if exists "Anyone can write a review" on public.product_reviews;
drop policy if exists "Admins moderate reviews" on public.product_reviews;
drop policy if exists "Admins delete reviews" on public.product_reviews;

create policy "Anyone can read published reviews"
  on public.product_reviews for select
  to anon, authenticated
  using (status = 'published' or public.is_roelix_admin());

-- A customer may only ever create a published review; hiding one is an admin act.
create policy "Anyone can write a review"
  on public.product_reviews for insert
  to anon, authenticated
  with check (status = 'published');

create policy "Admins moderate reviews"
  on public.product_reviews for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

create policy "Admins delete reviews"
  on public.product_reviews for delete
  to authenticated
  using (public.is_roelix_admin());

-- Live review counts on open product pages.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is missing; skipping realtime setup';
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.product_reviews;
  exception
    when duplicate_object then null;
  end;

  raise notice 'ROELIX: product_reviews is published to Realtime';
end $$;
