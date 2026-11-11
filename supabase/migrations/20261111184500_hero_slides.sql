create table if not exists public.hero_slides (
  id uuid primary key default gen_random_uuid(),
  image_url text not null check (image_url ~* '^https?://'),
  storage_path text not null,
  alt_text text not null check (length(btrim(alt_text)) between 1 and 240),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists hero_slides_active_order_idx
  on public.hero_slides (is_active, sort_order, created_at);

alter table public.hero_slides enable row level security;
grant select on public.hero_slides to anon, authenticated;
grant insert, update, delete on public.hero_slides to authenticated;

drop policy if exists "Anyone can read active hero slides" on public.hero_slides;
drop policy if exists "Anyone can read hero slides" on public.hero_slides;
create policy "Anyone can read hero slides"
  on public.hero_slides for select
  to anon, authenticated
  using (true);

drop policy if exists "Admins can read all hero slides" on public.hero_slides;
create policy "Admins can read all hero slides"
  on public.hero_slides for select
  to authenticated
  using (public.is_roelix_admin());

drop policy if exists "Admins can insert hero slides" on public.hero_slides;
create policy "Admins can insert hero slides"
  on public.hero_slides for insert
  to authenticated
  with check (public.is_roelix_admin());

drop policy if exists "Admins can update hero slides" on public.hero_slides;
create policy "Admins can update hero slides"
  on public.hero_slides for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

drop policy if exists "Admins can delete hero slides" on public.hero_slides;
create policy "Admins can delete hero slides"
  on public.hero_slides for delete
  to authenticated
  using (public.is_roelix_admin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hero-slides',
  'hero-slides',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view hero slide images" on storage.objects;
create policy "Anyone can view hero slide images"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'hero-slides');

drop policy if exists "Admins can upload hero slide images" on storage.objects;
create policy "Admins can upload hero slide images"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'hero-slides' and public.is_roelix_admin());

drop policy if exists "Admins can update hero slide images" on storage.objects;
create policy "Admins can update hero slide images"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'hero-slides' and public.is_roelix_admin())
  with check (bucket_id = 'hero-slides' and public.is_roelix_admin());

drop policy if exists "Admins can delete hero slide images" on storage.objects;
create policy "Admins can delete hero slide images"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'hero-slides' and public.is_roelix_admin());

notify pgrst, 'reload schema';
