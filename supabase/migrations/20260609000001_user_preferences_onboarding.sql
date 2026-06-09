alter table public.user_preferences
  add column if not exists onboarding_completed boolean not null default false;
