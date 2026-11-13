create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  logo_url text,
  favicon_url text,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "Anyone can read site settings" on public.site_settings;
create policy "Anyone can read site settings"
  on public.site_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can insert site settings" on public.site_settings;
create policy "Admins can insert site settings"
  on public.site_settings for insert
  to authenticated
  with check (public.is_roelix_admin());

drop policy if exists "Admins can update site settings" on public.site_settings;
create policy "Admins can update site settings"
  on public.site_settings for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

insert into public.site_settings (id)
values (1)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-branding',
  'site-branding',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view site branding" on storage.objects;
create policy "Anyone can view site branding"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'site-branding');

drop policy if exists "Admins can upload site branding" on storage.objects;
create policy "Admins can upload site branding"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-branding' and public.is_roelix_admin());

drop policy if exists "Admins can update site branding" on storage.objects;
create policy "Admins can update site branding"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-branding' and public.is_roelix_admin())
  with check (bucket_id = 'site-branding' and public.is_roelix_admin());

drop policy if exists "Admins can delete site branding" on storage.objects;
create policy "Admins can delete site branding"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-branding' and public.is_roelix_admin());

notify pgrst, 'reload schema';
