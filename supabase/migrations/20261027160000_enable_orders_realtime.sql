-- Publishes public.orders to Supabase Realtime.
--
-- The dashboard subscribes to this table so a checkout on any device appears
-- immediately, and so a status change made by another staff member lands without
-- a refresh. RLS still applies: only authenticated admins/staff receive rows
-- (policy "Staff and admins can read orders"), so anonymous customers never see
-- other people's orders through the channel.

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    raise notice 'supabase_realtime publication is missing; skipping realtime setup';
    return;
  end if;

  begin
    alter publication supabase_realtime add table public.orders;
  exception
    when duplicate_object then null;
  end;

  raise notice 'ROELIX: orders are published to Realtime';
end $$;
