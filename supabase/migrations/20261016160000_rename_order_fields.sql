alter table public.orders
  rename column customer_phone to phone;

alter table public.orders
  rename column customer_address to address;

alter table public.orders
  rename column grand_total to total_amount;
