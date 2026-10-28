-- Seeds the ROELIX catalogue's variant matrix.
--
-- Every catalogue product currently has zero rows in product_variants, so the
-- storefront falls back to plain size buttons and shows no SKU, no "was" price
-- and no per-size stock. This gives each product one row per size with its own
-- SKU, price, compare-at price and stock, which is what turns on the two button
-- groups, the SKU line, the discount badge and the exact stock count on the PDP.
--
-- Design notes:
--  * Prices are in the same base unit as `products.price` (the storefront
--    multiplies by EGP_PER_USD at render time), so the admin sees familiar
--    numbers and `resolveVariant` keeps working.
--  * Each product's seeded stock sums to its current `products.stock` and its
--    cheapest price equals its current `products.price`, so applying this
--    migration does not change what the shop advertises — it only adds detail.
--  * One dimension per size. The order-intake trigger resolves a line by
--    matching `orders.items[].size` against size_name/dimension/sku, so two rows
--    sharing a size name would make stock decrement ambiguous. A true
--    size x dimension grid needs dimension-aware order lines first.
--  * Re-running is safe: rows are matched on the unique SKU index, and any
--    product that already has a variant is skipped entirely so a curated matrix
--    is never mixed with seed data.
--  * Derived product fields are recalculated from the matrix afterwards, keeping
--    the invariant the admin save path also enforces (price = cheapest, stock =
--    total).

with seed (product_id, sku, size_name, dimension, price, compare_at_price, stock) as (
  values
    -- Aurelia Sateen Bedding Set (product price 690, stock 12)
    ('aurelia-sateen',      'AUR-SET-QN',  'Queen',      '200 × 200 cm', 690.00, 890.00,  5),
    ('aurelia-sateen',      'AUR-SET-KG',  'King',       '240 × 220 cm', 690.00, 890.00,  4),
    ('aurelia-sateen',      'AUR-SET-SK',  'Super King', '260 × 240 cm', 720.00, 950.00,  3),

    -- Palais Navy Duvet Cover (product price 480, stock 4)
    ('palais-duvet',        'PAL-DUV-QN',  'Queen',      '200 × 200 cm', 480.00, 620.00,  2),
    ('palais-duvet',        'PAL-DUV-KG',  'King',       '240 × 220 cm', 480.00, 620.00,  2),
    ('palais-duvet',        'PAL-DUV-SK',  'Super King', '260 × 240 cm', 520.00, 640.00,  0),

    -- Sanctuary Hotel Mattress Protector (product price 220, stock 30)
    ('sanctuary-protector', 'SAN-PRO-QN',  'Queen',      '160 × 200 cm', 220.00, 280.00, 12),
    ('sanctuary-protector', 'SAN-PRO-KG',  'King',       '180 × 200 cm', 240.00, 300.00, 10),
    ('sanctuary-protector', 'SAN-PRO-SK',  'Super King', '200 × 200 cm', 260.00, 320.00,  8),

    -- Cloud Hotel Microfiber Pillow (product price 140, stock 50)
    ('cloud-pillow',        'CLD-PIL-STD', 'Standard',   '50 × 70 cm',   140.00, 190.00, 30),
    ('cloud-pillow',        'CLD-PIL-KG',  'King',       '70 × 70 cm',   170.00, 230.00, 20),

    -- Riviera Gold-Band Towel Set (product price 260, stock 8)
    ('riviera-towels',      'RIV-TWL-4',   '4 Piece',    '70 × 140 cm',  260.00, 320.00,  5),
    ('riviera-towels',      'RIV-TWL-6',   '6 Piece',    '90 × 150 cm',  360.00, 440.00,  3)
)
insert into public.product_variants (product_id, sku, size_name, dimension, price, compare_at_price, stock)
select s.product_id, s.sku, s.size_name, s.dimension, s.price, s.compare_at_price, s.stock
  from seed s
  join public.products p on p.id = s.product_id
 where not exists (
         select 1
           from public.product_variants existing
          where existing.product_id = s.product_id
       )
on conflict (sku) do nothing;

-- Recalculate the derived roll-up for every seeded product that now has a matrix.
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
           min(v.price)                    as min_price,
           coalesce(sum(v.stock), 0)::int  as total_stock,
           array_agg(distinct v.size_name) filter (
             where v.size_name is not null and btrim(v.size_name) <> ''
           )                               as size_list
      from public.product_variants v
     where v.product_id in (
             'aurelia-sateen',
             'palais-duvet',
             'sanctuary-protector',
             'cloud-pillow',
             'riviera-towels'
           )
     group by v.product_id
  ) derived
 where p.id = derived.product_id;

do $$
declare
  seeded int;
begin
  select count(*) into seeded
    from public.product_variants
   where sku like 'AUR-SET-%'
      or sku like 'PAL-DUV-%'
      or sku like 'SAN-PRO-%'
      or sku like 'CLD-PIL-%'
      or sku like 'RIV-TWL-%';

  raise notice 'ROELIX: % catalogue variant rows present', seeded;
end $$;
