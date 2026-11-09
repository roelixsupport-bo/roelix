-- Repair deployments where the original approval migration did not replace
-- the legacy product_reviews status check constraint.
do $$
declare
  status_constraint record;
begin
  for status_constraint in
    select conname
    from pg_constraint
    where conrelid = 'public.product_reviews'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ~* '\mstatus\M'
  loop
    execute format(
      'alter table public.product_reviews drop constraint %I',
      status_constraint.conname
    );
  end loop;
end $$;

alter table public.product_reviews
  alter column status set default 'pending',
  add constraint product_reviews_status_check
    check (status in ('pending', 'published', 'hidden'));

notify pgrst, 'reload schema';
