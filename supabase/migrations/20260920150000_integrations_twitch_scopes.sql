-- The OAuth scopes the stored Twitch token carries, as id.twitch.tv reports
-- them: /oauth2/validate at sign-in, the scope array on every refresh, and
-- the hourly validation sweep in rest-api. Null means the token has not been
-- validated since this column existed; readers treat null as "nothing
-- missing", because those tokens were issued under the old sign-in that asked
-- for every scope.
alter table public.integrations_twitch
  add column if not exists twitch_scopes text[],
  add column if not exists scopes_synced_at timestamptz;

comment on column public.integrations_twitch.twitch_scopes is
  'Scopes on the stored token per id.twitch.tv; null = not validated since the column was added';
comment on column public.integrations_twitch.scopes_synced_at is
  'When twitch_scopes was last written from a validate or refresh response';
