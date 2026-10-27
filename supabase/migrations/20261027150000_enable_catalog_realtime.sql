-- Publishes the catalogue tables to Supabase Realtime.
--
-- Without this, open storefronts (especially mobile browsers whose sockets get
-- suspended) only see admin edits after a manual refresh. With it, every
-- products / product_variants write fans out to connected clients, where
-- src/lib/store.tsx re-reads the catalogue (RLS still applies, so anonymous
-- clients only receive published products).

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is missing; skipping realtime setup';
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.products;
  exception
    when duplicate_object then null;
  end;

  begin
    alter publication supabase_realtime add table public.product_variants;
  exception
    when duplicate_object then null;
  end;

  raise notice 'ROELIX: products and product_variants are published to Realtime';
end $$;
