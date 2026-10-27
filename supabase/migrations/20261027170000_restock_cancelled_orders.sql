-- Restocks inventory when an order is cancelled — exactly once.
--
-- Design notes:
--  * `restocked_at` makes the restock one-way. Cancelling, un-cancelling and
--    cancelling again cannot inflate stock, because the second cancellation sees
--    a non-null `restocked_at`.
--  * `inventory_applied_at` is stamped by the insert trigger, so only orders
--    whose stock was actually taken can ever give it back. Orders placed before
--    this migration have no stamp and are therefore never restocked (cancelling
--    an old order must not create stock out of thin air).
--  * The restock runs in a BEFORE UPDATE trigger so it can set `restocked_at` on
--    NEW without a second UPDATE against the same row (no trigger recursion).
--  * Matching mirrors the decrement path: size_name -> dimension -> sku, then a
--    product-level fallback, and `products.stock` is re-derived from the variant
--    matrix so the shop never advertises a total that disagrees with its sizes.

alter table public.orders
  add column if not exists restocked_at timestamptz,
  add column if not exists inventory_applied_at timestamptz;

-- 1. Decrement trigger: now BEFORE INSERT so it can stamp the row it consumes.
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
      update public.products as p
         set stock = (
               select coalesce(sum(v.stock), 0)
                 from public.product_variants as v
                where v.product_id = line_product_id
             ),
             updated_at = now()
       where p.id = line_product_id;
    else
      update public.products as p
         set stock = greatest(p.stock - line_quantity, 0),
             updated_at = now()
       where p.id = line_product_id;
    end if;
  end loop;

  new.inventory_applied_at := now();
  return new;
end;
$$;

drop trigger if exists orders_apply_inventory on public.orders;
create trigger orders_apply_inventory
  before insert on public.orders
  for each row
  execute function public.apply_order_inventory();

-- 2. Restock once, on the transition into 'cancelled'.
create or replace function public.restock_cancelled_order()
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
  if new.status is distinct from 'cancelled'
    or old.status = 'cancelled'
    or new.restocked_at is not null
    or new.inventory_applied_at is null then
    return new;
  end if;

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
         set stock = pv.stock + line_quantity
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
      update public.products as p
         set stock = (
               select coalesce(sum(v.stock), 0)
                 from public.product_variants as v
                where v.product_id = line_product_id
             ),
             updated_at = now()
       where p.id = line_product_id;
    else
      update public.products as p
         set stock = p.stock + line_quantity,
             updated_at = now()
       where p.id = line_product_id;
    end if;
  end loop;

  new.restocked_at := now();
  return new;
end;
$$;

drop trigger if exists orders_restock_on_cancel on public.orders;
create trigger orders_restock_on_cancel
  before update on public.orders
  for each row
  execute function public.restock_cancelled_order();

-- 3. The staff guard must tolerate the columns our triggers write, so a staff
--    member cancelling an order does not trip "Staff may only update order status".
create or replace function public.guard_staff_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_roelix_role() = 'staff'
    and (to_jsonb(new) - 'status' - 'restocked_at' - 'inventory_applied_at')
      is distinct from
        (to_jsonb(old) - 'status' - 'restocked_at' - 'inventory_applied_at') then
    raise exception 'Staff may only update order status';
  end if;
  return new;
end;
$$;

revoke all on function public.restock_cancelled_order() from public;
