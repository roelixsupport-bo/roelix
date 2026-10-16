create table public.products (
  id text primary key,
  name text not null,
  name_ar text not null default '',
  category text not null,
  price numeric(12, 2) not null check (price >= 0),
  images jsonb not null default '[]'::jsonb check (jsonb_typeof(images) = 'array'),
  description text not null default '',
  thread_count integer,
  gsm integer,
  origin text not null default '',
  stock integer not null default 0 check (stock >= 0),
  colors jsonb not null default '[]'::jsonb check (jsonb_typeof(colors) = 'array'),
  sizes jsonb not null default '[]'::jsonb check (jsonb_typeof(sizes) = 'array'),
  frequently_bought_ids jsonb not null default '[]'::jsonb
    check (jsonb_typeof(frequently_bought_ids) = 'array'),
  is_published boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.products enable row level security;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;

create policy "Anyone can read published products"
  on public.products for select
  to anon, authenticated
  using (is_published);

create policy "Admins can read all products"
  on public.products for select
  to authenticated
  using (public.is_roelix_admin());

create policy "Admins can insert products"
  on public.products for insert
  to authenticated
  with check (public.is_roelix_admin());

create policy "Admins can update products"
  on public.products for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

create policy "Admins can delete products"
  on public.products for delete
  to authenticated
  using (public.is_roelix_admin());

create table public.shipping_rates (
  governorate text primary key,
  cost_egp numeric(12, 2) not null check (cost_egp >= 0)
);

alter table public.shipping_rates enable row level security;
grant select on public.shipping_rates to anon, authenticated;

create policy "Anyone can read shipping rates"
  on public.shipping_rates for select
  to anon, authenticated
  using (true);

insert into public.shipping_rates (governorate, cost_egp) values
  ('القاهرة', 50),
  ('الجيزة', 50),
  ('القليوبية', 50),
  ('الإسكندرية', 65),
  ('البحيرة', 65),
  ('الشرقية', 75),
  ('الدقهلية', 75),
  ('الغربية', 75),
  ('المنوفية', 75),
  ('كفر الشيخ', 75),
  ('دمياط', 75),
  ('بورسعيد', 75),
  ('الإسماعيلية', 75),
  ('السويس', 75),
  ('الفيوم', 95),
  ('بني سويف', 95),
  ('المنيا', 95),
  ('أسيوط', 95),
  ('سوهاج', 95),
  ('قنا', 95),
  ('الأقصر', 95),
  ('أسوان', 95),
  ('مطروح', 120),
  ('البحر الأحمر', 120),
  ('الوادي الجديد', 120),
  ('شمال سيناء', 120),
  ('جنوب سيناء', 120);

alter table public.orders add column order_number text;
create unique index orders_order_number_unique
  on public.orders (upper(order_number))
  where order_number is not null;

create or replace function public.lookup_roelix_order_status(
  p_order_number text,
  p_phone text
)
returns table (order_number text, status text, total_amount numeric)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select o.order_number, o.status, o.total_amount
  from public.orders as o
  where p_order_number ~* '^[[:space:]]*RX-?[A-Z0-9]{6}[[:space:]]*$'
    and length(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')) between 8 and 15
    and upper(o.order_number) =
      regexp_replace(upper(trim(p_order_number)), '^RX-?', 'RX-')
    and regexp_replace(o.phone, '[^0-9]', '', 'g') =
      regexp_replace(p_phone, '[^0-9]', '', 'g')
  limit 1
$$;

revoke all on function public.lookup_roelix_order_status(text, text) from public;
grant execute on function public.lookup_roelix_order_status(text, text) to anon, authenticated;
