alter table public.site_settings
  add column if not exists cta_enabled boolean not null default false,
  add column if not exists cta_label_en text not null default '',
  add column if not exists cta_label_ar text not null default '',
  add column if not exists cta_url text not null default '';

alter table public.site_settings
  drop constraint if exists site_settings_cta_configuration_check,
  add constraint site_settings_cta_configuration_check
    check (
      not cta_enabled
      or (
        length(btrim(cta_label_en)) between 1 and 80
        and length(btrim(cta_label_ar)) between 1 and 80
        and cta_url ~* '^(https://|/[^/])'
      )
    );

create table if not exists public.promo_slides (
  id uuid primary key default gen_random_uuid(),
  message_en text not null check (length(btrim(message_en)) between 1 and 180),
  message_ar text not null check (length(btrim(message_ar)) between 1 and 180),
  target_url text not null check (target_url ~* '^(https://|/[^/])'),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists promo_slides_active_order_idx
  on public.promo_slides (is_active, sort_order, created_at);

alter table public.promo_slides enable row level security;
grant select on public.promo_slides to anon, authenticated;
grant insert, update, delete on public.promo_slides to authenticated;

drop policy if exists "Anyone can read active promo slides" on public.promo_slides;
create policy "Anyone can read active promo slides"
  on public.promo_slides for select
  to anon, authenticated
  using (is_active);

drop policy if exists "Admins can read all promo slides" on public.promo_slides;
create policy "Admins can read all promo slides"
  on public.promo_slides for select
  to authenticated
  using (public.is_roelix_admin());

drop policy if exists "Admins can insert promo slides" on public.promo_slides;
create policy "Admins can insert promo slides"
  on public.promo_slides for insert
  to authenticated
  with check (public.is_roelix_admin());

drop policy if exists "Admins can update promo slides" on public.promo_slides;
create policy "Admins can update promo slides"
  on public.promo_slides for update
  to authenticated
  using (public.is_roelix_admin())
  with check (public.is_roelix_admin());

drop policy if exists "Admins can delete promo slides" on public.promo_slides;
create policy "Admins can delete promo slides"
  on public.promo_slides for delete
  to authenticated
  using (public.is_roelix_admin());

notify pgrst, 'reload schema';
