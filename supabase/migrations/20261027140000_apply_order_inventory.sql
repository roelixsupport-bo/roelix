-- Decrements inventory when a checkout row lands in public.orders.
--
-- Checkout writes orders.items in this shape (see src/routes/checkout.tsx):
--   { "id": "aurelia-sateen", "qty": 2, "size": "King",
--     "color": "Ivory", "name": "Aurelia Sateen Bedding Set", "price": 39840 }
--
-- `size` carries the variant display label, which the storefront derives as
-- size_name -> dimension -> sku. The trigger tries all three, decrements exactly
-- one variant row, then re-derives the product roll-up so the advertised price
-- and stock never disagree with the variant matrix. Products without variants
-- fall back to decrementing products.stock directly.
--
-- Stock is clamped at zero rather than raising: an out-of-stock race must not
-- roll back a paid order. If you later want hard oversell protection, raise an
-- exception here instead of using greatest(..., 0).

create or replace function public.apply_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  line_product_id text;
  requested_size text;
  line_quantity integer;
  variant_matched boolean;
begin
  for item in
    select value from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    line_product_id := nullif(btrim(item ->> 'id'), '');
    requested_size := nullif(btrim(item ->> 'size'), '');

    line_quantity := case
      when jsonb_typeof(item -> 'qty') = 'number'
        then greatest(floor((item ->> 'qty')::numeric), 0)::integer
      else 0
    end;

    if line_product_id is null or line_quantity = 0 then
      continue;
    end if;

    variant_matched := false;

    if requested_size is not null then
      update public.product_variants as pv
         set stock = greatest(pv.stock - line_quantity, 0)
       where pv.id = (
         select candidate.id
           from public.product_variants as candidate
          where candidate.product_id = line_product_id
            and (
              candidate.size_name = requested_size
              or candidate.dimension = requested_size
              or candidate.sku = requested_size
            )
          order by
            (candidate.size_name = requested_size) desc,
            (candidate.dimension = requested_size) desc
          limit 1
       );

      variant_matched := found;
    end if;

    if variant_matched then
      -- Keep products.stock equal to sum(variant stock), the invariant the
      -- admin save path also enforces.
      update public.products as p
         set stock = (
               select coalesce(sum(v.stock), 0)
                 from public.product_variants as v
                where v.product_id = line_product_id
             ),
             updated_at = now()
       where p.id = line_product_id;
    else
      -- No variant matrix (or the label no longer matches one): decrement the
      -- product-level stock so orders still consume inventory.
      update public.products as p
         set stock = greatest(p.stock - line_quantity, 0),
             updated_at = now()
       where p.id = line_product_id;
    end if;
  end loop;

  return new;
end;
$$;

drop trigger if exists orders_apply_inventory on public.orders;
create trigger orders_apply_inventory
  after insert on public.orders
  for each row
  execute function public.apply_order_inventory();

-- Only the trigger should call this; it is SECURITY DEFINER so it can write
-- through RLS when an anonymous customer inserts their order.
revoke all on function public.apply_order_inventory() from public;
