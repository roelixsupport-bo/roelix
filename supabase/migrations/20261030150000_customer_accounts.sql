-- ROELIX customer accounts.
--
-- 20261016170000 created public.profiles for dashboard access only: it has an
-- id/email/role('admin','staff')/created_at shape and its trigger stamped every
-- new auth.users row as 'staff'. Storefront sign-ups therefore inherited staff
-- access to public.orders (the RLS policies use current_roelix_role() in
-- ('admin','staff')). This migration gives customers their own role, adds the
-- profile fields a shop account needs, and adds the two security-definer RPCs
-- the storefront uses so a customer can only ever touch their own row.

-- 1. A real customer role ------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'staff', 'customer'));

-- 2. Account columns -----------------------------------------------------------
alter table public.profiles add column if not exists full_name text;
alter table public.profiles
  add column if not exists marketing_opt_in boolean not null default false;
alter table public.profiles add column if not exists email_confirmed_at timestamptz;
alter table public.profiles add column if not exists last_sign_in_at timestamptz;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();

-- 3. Sign-ups are customers, not staff -----------------------------------------
-- The trigger itself already exists (on_auth_user_created_or_confirmed); only
-- the function body changes, so the old 'staff' default is replaced in place.
create or replace function public.sync_roelix_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role, full_name, email_confirmed_at)
  values (
    new.id,
    lower(new.email),
    case
      when lower(new.email) = 'roelix.support@gmail.com'
        and new.email_confirmed_at is not null then 'admin'
      else 'customer'
    end,
    nullif(btrim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    new.email_confirmed_at
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(public.profiles.full_name, excluded.full_name),
        email_confirmed_at = excluded.email_confirmed_at,
        updated_at = now(),
        role = case
          when excluded.email = 'roelix.support@gmail.com' then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

-- 4. Backfill the rows that already exist --------------------------------------
update public.profiles as profile
set email_confirmed_at = account.email_confirmed_at,
    full_name = coalesce(
      profile.full_name,
      nullif(btrim(coalesce(account.raw_user_meta_data ->> 'full_name', '')), '')
    ),
    updated_at = now()
from auth.users as account
where account.id = profile.id
  and profile.email_confirmed_at is null
  and account.email_confirmed_at is not null;

-- 5. Self-service RPCs ---------------------------------------------------------
-- Customers cannot update public.profiles directly: the only update policy is
-- admin-only. These two functions are the narrow doors they are allowed through.
create or replace function public.update_roelix_customer_profile(
  p_full_name text,
  p_marketing_opt_in boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;

  update public.profiles
  set full_name = nullif(btrim(coalesce(p_full_name, '')), ''),
      marketing_opt_in = coalesce(p_marketing_opt_in, marketing_opt_in),
      updated_at = now()
  where id = viewer;
end;
$$;

create or replace function public.touch_roelix_session()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  viewer uuid := auth.uid();
begin
  if viewer is null then
    return;
  end if;

  update public.profiles as profile
  set last_sign_in_at = now(),
      email_confirmed_at = coalesce(
        (select account.email_confirmed_at from auth.users as account where account.id = viewer),
        profile.email_confirmed_at
      ),
      updated_at = now()
  where profile.id = viewer;
end;
$$;

grant execute on function public.update_roelix_customer_profile(text, boolean) to authenticated;
grant execute on function public.touch_roelix_session() to authenticated;

-- No insert/delete grant on public.profiles for authenticated: rows are written
-- by the auth trigger and by the two functions above only.

-- 6. Legacy staff rows ---------------------------------------------------------
-- Every storefront sign-up before this migration was created as 'staff' by the
-- old trigger, which grants read access to public.orders. Demoting them
-- automatically would also strip access from staff accounts provisioned by hand
-- in the Supabase dashboard, so this stays a deliberate, one-off decision:
--
--   update public.profiles
--   set role = 'customer'
--   where role = 'staff' and email <> 'roelix.support@gmail.com';
