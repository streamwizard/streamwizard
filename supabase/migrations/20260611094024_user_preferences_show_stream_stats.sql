alter table public.user_preferences
  add column if not exists show_stream_stats boolean not null default true;
