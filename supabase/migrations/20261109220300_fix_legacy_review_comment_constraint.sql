-- Older deployments may have both `comment` and `body`; the application writes
-- `body`, so the obsolete `comment` column must not reject the insert as NULL.
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'comment'
  ) and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'body'
  ) then
    alter table public.product_reviews
      alter column comment drop not null;
  end if;
end $$;

notify pgrst, 'reload schema';
