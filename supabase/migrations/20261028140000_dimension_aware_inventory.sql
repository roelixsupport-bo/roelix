-- Dimension-aware order intake and restocking.
--
-- Order lines now carry an optional `dimension` alongside `size`:
--   { "id": "cloud-pillow", "size": "Standard", "dimension": "50 × 70 cm", ... }
--
-- Until now all three inventory functions resolved a line by matching
-- `items[].size` against size_name/dimension/sku. That is ambiguous the moment a
-- product sells one size in two dimensions, and it silently decremented an
-- arbitrary row. Each function now narrows on the dimension when the line
-- carries one, while still working for rows written before this change (no
-- dimension -> old, size-only behaviour).
--
-- Matching order matters: an exact dimension is the strongest signal, then the
-- size name (the storefront sends the size name), then the dimension used as the
-- size label, then the SKU.

-- 1. Intake: stamp a line id and decrement the exact variant -------------------
create or replace function public.apply_order_inventory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_items jsonb := '[]'::jsonb;
  line_product_id text;
  requested_size text;
  requested_dimension text;
  line_quantity integer;
  variant_matched boolean;
begin
  for item in
    select value from jsonb_array_elements(coalesce(new.items, '[]'::jsonb))
  loop
    line_product_id := nullif(btrim(item ->> 'id'), '');
    requested_size := nullif(btrim(item ->> 'size'), '');
    requested_dimension := nullif(btrim(item ->> 'dimension'), '');

    line_quantity := case
      when jsonb_typeof(item -> 'qty') = 'number'
        then greatest(floor((item ->> 'qty')::numeric), 0)::integer
      else 0
    end;

    if coalesce(item ->> 'line_id', '') = '' then
      item := item || jsonb_build_object('line_id', gen_random_uuid()::text);
    end if;

    if line_product_id is not null and line_quantity > 0 then
      variant_matched := false;

      if requested_size is not null or requested_dimension is not null then
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
              and (
                requested_dimension is null
                or candidate.dimension = requested_dimension
              )
            order by
              coalesce(candidate.dimension = requested_dimension, false) desc,
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
    end if;

    v_items := v_items || jsonb_build_array(item);
  end loop;

  new.items := v_items;
  new.inventory_applied_at := now();
  return new;
end;
$$;

-- 2. Cancellation: return only what has not already been returned ---------------
create or replace function public.restock_cancelled_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  v_items jsonb := '[]'::jsonb;
  line_product_id text;
  requested_size text;
  requested_dimension text;
  line_quantity integer;
  already_restocked integer;
  restock_quantity integer;
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
    requested_dimension := nullif(btrim(item ->> 'dimension'), '');

    line_quantity := case
      when jsonb_typeof(item -> 'qty') = 'number'
        then greatest(floor((item ->> 'qty')::numeric), 0)::integer
      else 0
    end;
    already_restocked := case
      when jsonb_typeof(item -> 'restocked_quantity') = 'number'
        then greatest(floor((item ->> 'restocked_quantity')::numeric), 0)::integer
      else 0
    end;
    restock_quantity := greatest(line_quantity - already_restocked, 0);

    if line_product_id is not null and restock_quantity > 0 then
      variant_matched := false;

      if requested_size is not null or requested_dimension is not null then
        update public.product_variants as pv
           set stock = pv.stock + restock_quantity
         where pv.id = (
           select candidate.id
             from public.product_variants as candidate
            where candidate.product_id = line_product_id
              and (
                candidate.size_name = requested_size
                or candidate.dimension = requested_size
                or candidate.sku = requested_size
              )
              and (
                requested_dimension is null
                or candidate.dimension = requested_dimension
              )
            order by
              coalesce(candidate.dimension = requested_dimension, false) desc,
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
           set stock = p.stock + restock_quantity,
               updated_at = now()
         where p.id = line_product_id;
      end if;

      item := jsonb_set(item, '{restocked_quantity}', to_jsonb(line_quantity), true);
    end if;

    v_items := v_items || jsonb_build_array(item);
  end loop;

  new.items := v_items;
  new.restocked_at := now();
  return new;
end;
$$;

-- 3. Partial return of one line -------------------------------------------------
create or replace function public.restock_order_line(
  p_order_id uuid,
  p_line_id text,
  p_quantity integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_line_id text;
  v_line_quantity integer;
  v_already integer;
  v_restock integer;
  v_product_id text;
  v_size text;
  v_dimension text;
  v_variant_matched boolean;
  v_matched boolean := false;
begin
  if not coalesce(public.is_roelix_admin(), false) then
    raise exception 'Only ROELIX administrators can return items to stock'
      using errcode = '42501';
  end if;

  if p_quantity is null or p_quantity < 1 then
    raise exception 'Return quantity must be at least 1';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order % was not found', p_order_id;
  end if;
  if v_order.inventory_applied_at is null then
    raise exception 'This order predates inventory tracking, so its stock was never deducted';
  end if;

  for item in
    select value from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb))
  loop
    v_line_id := coalesce(item ->> 'line_id', '');

    if v_line_id = p_line_id then
      v_matched := true;
      v_product_id := nullif(btrim(item ->> 'id'), '');
      v_size := nullif(btrim(item ->> 'size'), '');
      v_dimension := nullif(btrim(item ->> 'dimension'), '');

      v_line_quantity := case
        when jsonb_typeof(item -> 'qty') = 'number'
          then greatest(floor((item ->> 'qty')::numeric), 0)::integer
        else 0
      end;
      v_already := case
        when jsonb_typeof(item -> 'restocked_quantity') = 'number'
          then greatest(floor((item ->> 'restocked_quantity')::numeric), 0)::integer
        else 0
      end;
      v_restock := least(p_quantity, greatest(v_line_quantity - v_already, 0));

      if v_restock = 0 then
        raise exception 'Nothing left to return on this line';
      end if;

      v_variant_matched := false;

      if v_product_id is not null and (v_size is not null or v_dimension is not null) then
        update public.product_variants as pv
           set stock = pv.stock + v_restock
         where pv.id = (
           select candidate.id
             from public.product_variants as candidate
            where candidate.product_id = v_product_id
              and (
                candidate.size_name = v_size
                or candidate.dimension = v_size
                or candidate.sku = v_size
              )
              and (
                v_dimension is null
                or candidate.dimension = v_dimension
              )
            order by
              coalesce(candidate.dimension = v_dimension, false) desc,
              (candidate.size_name = v_size) desc,
              (candidate.dimension = v_size) desc
            limit 1
         );

        v_variant_matched := found;
      end if;

      if v_variant_matched then
        update public.products as p
           set stock = (
                 select coalesce(sum(v.stock), 0)
                   from public.product_variants as v
                  where v.product_id = v_product_id
               ),
               updated_at = now()
         where p.id = v_product_id;
      elsif v_product_id is not null then
        update public.products as p
           set stock = p.stock + v_restock,
               updated_at = now()
         where p.id = v_product_id;
      end if;

      item := jsonb_set(item, '{restocked_quantity}', to_jsonb(v_already + v_restock), true);
    end if;

    v_items := v_items || jsonb_build_array(item);
  end loop;

  if not v_matched then
    raise exception 'Line % was not found on this order', p_line_id;
  end if;

  update public.orders
     set items = v_items
   where id = p_order_id;

  return v_restock;
end;
$$;

revoke all on function public.restock_order_line(uuid, text, integer) from public;
grant execute on function public.restock_order_line(uuid, text, integer) to authenticated;
revoke all on function public.restock_cancelled_order() from public;
