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
          when excluded.email = 'roelix.support@gmail.com'
            and excluded.role = 'admin' then 'admin'
          else public.profiles.role
        end;
  return new;
end;
$$;

update public.profiles as profile
set role = case
  when auth_user.email_confirmed_at is not null then 'admin'
  else 'staff'
end
from auth.users as auth_user
where profile.id = auth_user.id
  and lower(auth_user.email) = 'roelix.support@gmail.com';
