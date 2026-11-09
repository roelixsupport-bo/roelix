-- Allow customers to update only their own active reviews. The trigger keeps
-- review identity fields immutable and returns every edited review to pending.
drop policy if exists "Customers update their own reviews" on public.product_reviews;
create policy "Customers update their own reviews"
  on public.product_reviews for update
  to authenticated
  using (
    user_id = auth.uid()
    and status in ('pending', 'published')
  )
  with check (
    user_id = auth.uid()
    and status = 'pending'
  );

create or replace function public.guard_customer_product_review_edit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_roelix_admin() then
    return new;
  end if;

  if auth.uid() is null or old.user_id is distinct from auth.uid() then
    raise exception 'You can only edit a review written by your account';
  end if;

  if old.status not in ('pending', 'published') then
    raise exception 'This review cannot be edited';
  end if;

  if new.product_id is distinct from old.product_id
    or new.author_name is distinct from old.author_name
    or new.user_id is distinct from old.user_id
    or new.image_url is distinct from old.image_url
    or new.created_at is distinct from old.created_at then
    raise exception 'Review identity and photo fields cannot be changed';
  end if;

  new.status := 'pending';
  new.official_reply := null;
  new.replied_at := null;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists guard_customer_product_review_edit on public.product_reviews;
create trigger guard_customer_product_review_edit
  before update on public.product_reviews
  for each row execute function public.guard_customer_product_review_edit();

drop function if exists public.edit_own_product_review(uuid, smallint, text);
