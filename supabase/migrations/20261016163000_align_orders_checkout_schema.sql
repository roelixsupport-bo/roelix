alter table public.orders
  drop column if exists order_number,
  drop column if exists customer_email,
  drop column if exists customer_city,
  drop column if exists country,
  drop column if exists payment_method;
