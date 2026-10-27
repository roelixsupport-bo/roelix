-- ROELIX repair migration.
--
-- 20261027120000 declared product_variants.product_id as uuid, but
-- public.products.id is text. That foreign key can never be created, so the
-- earlier migration aborted and product_variants (plus product_details /
-- product_care) were missing. This migration is idempotent: it repairs an
-- environment where the uuid column was created by hand, then provisions the
-- product-images storage bucket used by the admin dashboard.

-- 1. Detail + care copy -------------------------------------------------------
alter table if exists public.products add column if not exists product_details text;
alter table if exists public.products add column if not exists product_care text;

-- 2. Variants table -----------------------------------------------------------
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

-- 3. Convert an existing uuid product_id to text ------------------------------
do $$
declare
  product_id_type text;
  fk_name text;
begin
  select c.data_type into product_id_type
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'product_variants'
    and c.column_name = 'product_id';

  if product_id_type is not null and product_id_type <> 'text' then
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'product_variants'
      and con.contype = 'f'
    limit 1;

    if fk_name is not null then
      execute format('alter table public.product_variants drop constraint %I', fk_name);
    end if;

    execute 'alter table public.product_variants alter column product_id type text using product_id::text';
  end if;
end $$;

-- 4. Make sure the foreign key exists -----------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'product_variants'
      and con.contype = 'f'
  ) then
    alter table public.product_variants
      add constraint product_variants_product_id_fkey
      foreign key (product_id) references public.products(id) on delete cascade;
  end if;
end $$;

create unique index if not exists product_variants_sku_key on public.product_variants (sku);
create index if not exists product_variants_product_id_idx on public.product_variants (product_id);

-- 5. Row level security -------------------------------------------------------
alter table public.product_variants enable row level security;
grant select on public.product_variants to anon, authenticated;
grant insert, update, delete on public.product_variants to authenticated;

drop policy if exists "Allow public read access on product_variants" on public.product_variants;
drop policy if exists "Allow admin full access on product_variants" on public.product_variants;
drop policy if exists "Anyone can read product variants" on public.product_variants;
drop policy if exists "Admins manage product variants" on public.product_variants;

create policy "Anyone can read product variants"
  on public.product_variants for select
  to anon, authenticated
  using (true);

create policy "Admins manage product variants"
  on public.product_variants for all
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

-- 6. Storage bucket for uploaded product photography --------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view product images" on storage.objects;
drop policy if exists "Admins can upload product images" on storage.objects;
drop policy if exists "Admins can update product images" on storage.objects;
drop policy if exists "Admins can delete product images" on storage.objects;

create policy "Anyone can view product images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-images');

create policy "Admins can upload product images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-images' and public.is_roelix_admin());

create policy "Admins can update product images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-images' and public.is_roelix_admin())
  with check (bucket_id = 'product-images' and public.is_roelix_admin());

create policy "Admins can delete product images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'product-images' and public.is_roelix_admin());
