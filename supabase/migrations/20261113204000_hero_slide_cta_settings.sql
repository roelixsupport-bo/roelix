alter table public.hero_slides
  add column if not exists show_button boolean not null default false,
  add column if not exists button_text_ar text not null default '',
  add column if not exists button_text_en text not null default '',
  add column if not exists button_url text not null default '',
  add column if not exists button_position text not null default 'bottom-center';

alter table public.hero_slides
  drop constraint if exists hero_slides_button_position_check,
  add constraint hero_slides_button_position_check
    check (button_position in ('bottom-left', 'bottom-center', 'bottom-right')),
  drop constraint if exists hero_slides_button_configuration_check,
  add constraint hero_slides_button_configuration_check
    check (
      not show_button
      or (
        length(btrim(button_text_ar)) between 1 and 80
        and length(btrim(button_text_en)) between 1 and 80
        and button_url ~* '^(https://|/[^/])'
      )
    );

notify pgrst, 'reload schema';
