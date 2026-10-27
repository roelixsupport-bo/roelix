-- 1. Detail + care copy for the storefront accordions
alter table if exists public.products
  add column if not exists product_details text,
  add column if not exists product_care text;

-- 2. Product variants (sizes, dimensions, per-variant price and stock).
--    public.products.id is text, so product_id must be text as well.
create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references public.products(id) on delete cascade,
  sku text not null,
  size_name text,
  dimension text,
  price numeric(10, 2) not null default 0 check (price >= 0),
  compare_at_price numeric(10, 2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists product_variants_sku_key on public.product_variants (sku);
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);

-- 3. Row level security: everyone reads, ROELIX admins write
alter table public.product_variants enable row level security;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

drop policy if exists "Anyone can read product variants" on public.product_variants;
create policy "Anyone can read product variants"
  on public.product_variants for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins manage product variants" on public.product_variants;
create policy "Admins manage product variants"
  on public.product_variants for all
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());
