create table irl_collector_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  token         text not null unique,
  name          text not null default 'My IRL Device',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

alter table irl_collector_tokens enable row level security;

create policy "Users manage own tokens"
  on irl_collector_tokens
  using (auth.uid() = user_id);
