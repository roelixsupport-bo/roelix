create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  customer_address text not null,
  customer_city text not null,
  governorate text not null,
  country text not null default 'Egypt',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal numeric(12, 2) not null check (subtotal >= 0),
  shipping_cost numeric(12, 2) not null check (shipping_cost >= 0),
  grand_total numeric(12, 2) not null check (grand_total = subtotal + shipping_cost),
  payment_method text not null check (payment_method in ('card', 'cod')),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'shipped', 'delivered', 'cancelled')),
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;
grant insert on table public.orders to anon, authenticated;

create policy "Allow public order submissions"
  on public.orders
  for insert
  to anon, authenticated
  with check (status = 'pending');
