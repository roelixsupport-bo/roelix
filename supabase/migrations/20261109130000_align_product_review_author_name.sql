-- Align legacy product_reviews.user_name with the author_name column written
-- by the storefront, preserving existing review names.
do $$
declare
  has_user_name boolean;
  has_author_name boolean;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'user_name'
  ) into has_user_name;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'product_reviews'
      and column_name = 'author_name'
  ) into has_author_name;

  if has_user_name and not has_author_name then
    alter table public.product_reviews rename column user_name to author_name;
  elsif has_user_name and has_author_name then
    update public.product_reviews
    set author_name = user_name
    where (author_name is null or btrim(author_name) = '')
      and user_name is not null
      and btrim(user_name) <> '';

    alter table public.product_reviews
      alter column user_name drop not null;
  end if;
end $$;

notify pgrst, 'reload schema';
