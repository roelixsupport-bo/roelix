create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
grant select, update on public.profiles to authenticated;

create or replace function public.current_roelix_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = (select auth.uid())
$$;

create or replace function public.is_roelix_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_roelix_role() = 'admin', false)
$$;

grant execute on function public.current_roelix_role() to authenticated;
grant execute on function public.is_roelix_admin() to authenticated;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()));

create policy "Admins can read all profiles"
  on public.profiles for select
  to authenticated
  using (public.is_roelix_admin());

create policy "Admins can update profile roles"
  on public.profiles for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

create or replace function public.sync_roelix_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case
      when lower(new.email) = 'roelix.support@gmail.com'
        and new.email_confirmed_at is not null then 'admin'
      else 'staff'
    end
  )
  on conflict (id) do update
    set email = excluded.email,
        role = case
          when excluded.email = 'roelix.support@gmail.com' then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

create trigger on_auth_user_created_or_confirmed
  after insert or update of email, email_confirmed_at on auth.users
  for each row execute function public.sync_roelix_profile();

insert into public.profiles (id, email, role)
select
  id,
  lower(email),
  case
    when lower(email) = 'roelix.support@gmail.com'
      and email_confirmed_at is not null then 'admin'
    else 'staff'
  end
from auth.users
where email is not null
on conflict (id) do update
  set email = excluded.email,
      role = case
        when excluded.email = 'roelix.support@gmail.com' then 'admin'
        else public.profiles.role
      end;

grant select, update, delete on public.orders to authenticated;

create policy "Staff and admins can read orders"
  on public.orders for select
  to authenticated
  using (public.current_roelix_role() in ('admin', 'staff'));

create policy "Staff and admins can update orders"
  on public.orders for update
  to authenticated
  using (public.current_roelix_role() in ('admin', 'staff'))
  with check (public.current_roelix_role() in ('admin', 'staff'));

create policy "Only admins can delete orders"
  on public.orders for delete
  to authenticated
  using (public.is_roelix_admin());

create or replace function public.guard_staff_order_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.current_roelix_role() = 'staff'
    and (to_jsonb(new) - 'status') is distinct from (to_jsonb(old) - 'status') then
    raise exception 'Staff may only update order status';
  end if;
  return new;
end;
$$;

create trigger guard_staff_order_changes
  before update on public.orders
  for each row execute function public.guard_staff_order_changes();
