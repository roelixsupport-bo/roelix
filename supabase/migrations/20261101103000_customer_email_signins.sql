-- ROELIX customer email sign-ins.
--
-- The storefront signs customers in with an email address alone (Supabase magic
-- link / six-digit code). public.profiles can only describe someone who already
-- has an auth.users row, so an address typed into the sign-in modal had nowhere
-- to land until that person completed the round trip through their inbox.
--
-- public.customers is the register of every address the store has been given:
-- written the moment the customer submits the form, linked to auth.users once
-- they authenticate, and readable/mutable only by the dashboard's admins.
--
-- Write paths:
--   * capture_roelix_customer_email(...) — callable by `anon`, because the
--     visitor is not signed in yet. Security definer, validates the address and
--     never exposes the table.
--   * link_roelix_customer_account() — signed-in customers only; attaches
--     auth.uid() to the row and counts the sign in.
--   * the profiles trigger — keeps the link even when the app forgets to call.

-- 1. Table -------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  -- Always stored lower-cased; the unique constraint is what makes capture an
  -- idempotent upsert rather than a new row per submit.
  email text not null unique,
  marketing_opt_in boolean not null default true,
  source text not null default 'signin_modal',
  sign_in_count integer not null default 0,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  notes text,
  updated_at timestamptz not null default now(),
  constraint customers_email_lowercase check (email = lower(btrim(email)))
);

create unique index if not exists customers_user_id_unique
  on public.customers (user_id)
  where user_id is not null;

create index if not exists customers_last_seen_idx
  on public.customers (last_seen_at desc);

alter table public.customers enable row level security;

grant select, update, delete on public.customers to authenticated;
-- No insert grant: rows are written by the two functions below only.

drop policy if exists "Admins can read customer emails" on public.customers;
create policy "Admins can read customer emails"
  on public.customers for select
  to authenticated
  using (public.is_roelix_admin());

drop policy if exists "Admins can update customer emails" on public.customers;
create policy "Admins can update customer emails"
  on public.customers for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

drop policy if exists "Admins can delete customer emails" on public.customers;
create policy "Admins can delete customer emails"
  on public.customers for delete
  to authenticated
  using (public.is_roelix_admin());

-- 2. Capture (anonymous-safe) -------------------------------------------------
-- Called before Supabase sends the link, so the address is on the register even
-- if the customer never opens the email. Re-submitting refreshes last_seen_at
-- and the marketing verdict instead of creating a duplicate.
create or replace function public.capture_roelix_customer_email(
  p_email text,
  p_marketing_opt_in boolean default true,
  p_source text default 'signin_modal'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_email text := lower(btrim(coalesce(p_email, '')));
  clean_source text := nullif(btrim(coalesce(p_source, '')), '');
  viewer uuid := auth.uid();
begin
  if clean_email = '' or clean_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;

  insert into public.customers (email, marketing_opt_in, source, user_id, last_seen_at)
  values (clean_email, coalesce(p_marketing_opt_in, true), coalesce(clean_source, 'signin_modal'), viewer, now())
  on conflict (email) do update
    set marketing_opt_in = excluded.marketing_opt_in,
        user_id = coalesce(public.customers.user_id, excluded.user_id),
        last_seen_at = now(),
        updated_at = now();
end;
$$;

grant execute on function public.capture_roelix_customer_email(text, boolean, text)
  to anon, authenticated;

-- 3. Link on sign in ----------------------------------------------------------
create or replace function public.link_roelix_customer_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
  viewer_email text;
begin
  if viewer is null then
    return;
  end if;

  select lower(account.email) into viewer_email
  from auth.users as account
  where account.id = viewer;

  if viewer_email is null or viewer_email = '' then
    return;
  end if;

  insert into public.customers (email, user_id, source, sign_in_count, last_seen_at)
  values (viewer_email, viewer, 'signin_modal', 1, now())
  on conflict (email) do update
    set user_id = viewer,
        sign_in_count = public.customers.sign_in_count + 1,
        last_seen_at = now(),
        updated_at = now();
end;
$$;

grant execute on function public.link_roelix_customer_account() to authenticated;

-- 4. Link when the profile row appears ---------------------------------------
-- signUp / first magic-link sign-in inserts public.profiles from the auth
-- trigger; this is the same moment the address becomes a real account, so the
-- two registers are joined without the client having to remember.
create or replace function public.link_roelix_customer_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.customers
  set user_id = new.id,
      updated_at = now()
  where lower(email) = lower(new.email)
    and (user_id is null or user_id = new.id);

  return new;
end;
$$;

drop trigger if exists link_customer_email_on_profile on public.profiles;
create trigger link_customer_email_on_profile
  after insert or update of email on public.profiles
  for each row execute function public.link_roelix_customer_profile();

-- 5. Realtime (best effort) ---------------------------------------------------
-- The dashboard can watch new sign-in addresses live; a deployment without the
-- publication simply skips this block instead of failing the migration.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'customers'
    )
  then
    alter publication supabase_realtime add table public.customers;
  end if;
end;
$$;
