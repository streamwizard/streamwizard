alter table public.user_preferences
  add column if not exists memes_enabled boolean not null default true;
