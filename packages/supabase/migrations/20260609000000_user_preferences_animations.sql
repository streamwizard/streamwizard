alter table public.user_preferences
  add column if not exists theme_animations_enabled boolean not null default true;
