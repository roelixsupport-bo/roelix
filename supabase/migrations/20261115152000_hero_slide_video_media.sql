alter table public.hero_slides
  add column if not exists media_type text not null default 'image',
  add column if not exists video_url text,
  add column if not exists title_ar text not null default '',
  add column if not exists title_en text not null default '',
  add column if not exists description_ar text not null default '',
  add column if not exists description_en text not null default '';

alter table public.hero_slides
  alter column image_url drop not null,
  alter column storage_path drop not null,
  drop constraint if exists hero_slides_media_type_check,
  add constraint hero_slides_media_type_check
    check (media_type in ('image', 'video')),
  drop constraint if exists hero_slides_media_source_check,
  add constraint hero_slides_media_source_check
    check (
      (
        media_type = 'image'
        and image_url is not null
        and video_url is null
      )
      or (
        media_type = 'video'
        and image_url is null
        and video_url is not null
        and video_url ~* '^(https://|/[^/])'
      )
    ),
  drop constraint if exists hero_slides_title_length_check,
  add constraint hero_slides_title_length_check
    check (length(title_ar) <= 160 and length(title_en) <= 160),
  drop constraint if exists hero_slides_description_length_check,
  add constraint hero_slides_description_length_check
    check (length(description_ar) <= 500 and length(description_en) <= 500);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'hero-slides',
  'hero-slides',
  true,
  52428800,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'video/mp4']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = greatest(storage.buckets.file_size_limit, excluded.file_size_limit),
      allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
