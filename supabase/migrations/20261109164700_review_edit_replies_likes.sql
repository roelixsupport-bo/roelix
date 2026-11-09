-- Customer-owned review edits, public staff replies, and authenticated likes.
alter table public.product_reviews
  add column if not exists official_reply text,
  add column if not exists replied_at timestamptz,
  add column if not exists updated_at timestamptz not null default now();

alter table public.product_reviews
  drop constraint if exists product_reviews_official_reply_check;

update public.product_reviews
set official_reply = null
where official_reply is not null and btrim(official_reply) = '';

alter table public.product_reviews
  add constraint product_reviews_official_reply_check
    check (official_reply is null or char_length(btrim(official_reply)) between 1 and 2000);

create table if not exists public.product_review_likes (
  review_id uuid not null references public.product_reviews(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);

alter table public.product_review_likes enable row level security;
revoke all on public.product_review_likes from anon, authenticated;

create or replace function public.edit_own_product_review(
  p_review_id uuid,
  p_rating smallint,
  p_body text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Sign in to edit your review';
  end if;
  if p_body is null
    or p_rating is null
    or p_rating not between 1 and 5
    or char_length(btrim(p_body)) not between 4 and 2000 then
    raise exception 'The review did not pass validation';
  end if;

  update public.product_reviews
  set rating = p_rating,
      body = btrim(p_body),
      status = 'pending',
      official_reply = null,
      replied_at = null,
      updated_at = now()
  where id = p_review_id
    and user_id = auth.uid()
    and status in ('pending', 'published');

  get diagnostics changed_rows = row_count;
  return changed_rows = 1;
end;
$$;

revoke all on function public.edit_own_product_review(uuid, smallint, text) from public, anon;
grant execute on function public.edit_own_product_review(uuid, smallint, text) to authenticated;

create or replace function public.get_product_review_likes(p_review_ids uuid[])
returns table(review_id uuid, likes_count bigint, liked_by_me boolean)
language sql
stable
security definer
set search_path = public
as $$
  select requested.review_id,
         count(like_row.user_id) as likes_count,
         coalesce(bool_or(like_row.user_id = auth.uid()), false) as liked_by_me
  from unnest(coalesce(p_review_ids, '{}'::uuid[])) as requested(review_id)
  join public.product_reviews review_row
    on review_row.id = requested.review_id
   and review_row.status = 'published'
  left join public.product_review_likes like_row
    on like_row.review_id = requested.review_id
  group by requested.review_id
$$;

revoke all on function public.get_product_review_likes(uuid[]) from public;
grant execute on function public.get_product_review_likes(uuid[]) to anon, authenticated;

create or replace function public.toggle_product_review_like(p_review_id uuid)
returns table(likes_count bigint, liked_by_me boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Sign in to like a review';
  end if;
  if not exists (
    select 1
    from public.product_reviews
    where id = p_review_id and status = 'published'
  ) then
    raise exception 'This review is not available';
  end if;

  delete from public.product_review_likes
  where review_id = p_review_id and user_id = current_user_id;

  if not found then
    insert into public.product_review_likes (review_id, user_id)
    values (p_review_id, current_user_id)
    on conflict do nothing;
  end if;

  return query
  select count(*)::bigint,
         exists (
           select 1
           from public.product_review_likes
           where review_id = p_review_id and user_id = current_user_id
         )
  from public.product_review_likes
  where review_id = p_review_id;
end;
$$;

revoke all on function public.toggle_product_review_like(uuid) from public, anon;
grant execute on function public.toggle_product_review_like(uuid) to authenticated;

comment on column public.product_reviews.official_reply is
  'Public reply from the ROELIX team, displayed beneath the published review.';
