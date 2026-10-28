-- Upgrades the seeded pillow to a genuine size × dimension grid.
--
-- 20261028130000 gave every product one dimension per size because the order
-- triggers matched on size alone. With dimension-aware intake in place
-- (20261028140000) a size may now be sold in several dimensions, so the pillow
-- gets the cross product the buying brief describes:
--
--   Standard / 50 × 70 cm   stock 30   (from the original seed)
--   Standard / 70 × 70 cm   stock 0    (new, sold out)
--   King     / 50 × 70 cm   stock 0    (new, sold out)
--   King     / 70 × 70 cm   stock 20   (from the original seed)
--
-- The two new rows carry no stock on purpose: they demonstrate the sold-out
-- state and the disabled combination without changing what the shop advertises.
-- Price (cheapest = 140) and total stock (50) stay exactly as they were.
--
-- Only applies when the pillow already has a variant matrix, so a hand-curated
-- product is never touched, and the SKU index keeps it idempotent.

with extra (product_id, sku, size_name, dimension, price, compare_at_price, stock) as (
  values
    ('cloud-pillow', 'CLD-PIL-STD-7070', 'Standard', '70 × 70 cm', 155.00, 205.00, 0),
    ('cloud-pillow', 'CLD-PIL-KG-5070',  'King',     '50 × 70 cm', 160.00, 215.00, 0)
)
insert into public.product_variants (product_id, sku, size_name, dimension, price, compare_at_price, stock)
select e.product_id, e.sku, e.size_name, e.dimension, e.price, e.compare_at_price, e.stock
  from extra e
  join public.products p on p.id = e.product_id
 where exists (
         select 1
           from public.product_variants existing
          where existing.product_id = e.product_id
       )
on conflict (sku) do nothing;

update public.products as p
   set price = derived.min_price,
       stock = derived.total_stock,
       sizes = case
                 when cardinality(derived.size_list) > 0 then derived.size_list
                 else p.sizes
               end,
       updated_at = now()
  from (
    select v.product_id,
           min(v.price)                   as min_price,
           coalesce(sum(v.stock), 0)::int as total_stock,
           array_agg(distinct v.size_name) filter (
             where v.size_name is not null and btrim(v.size_name) <> ''
           )                              as size_list
      from public.product_variants v
     where v.product_id = 'cloud-pillow'
     group by v.product_id
  ) derived
 where p.id = derived.product_id;
