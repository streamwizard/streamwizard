-- Stream labels: the "latest" values behind the overlay Label widget.
-- One row per streamer, one column per kind of event.
--
-- Why not read stream_events: that table only gets a row while the channel is
-- live, so a follow or a gift that lands offline never reaches it and "latest
-- follower" would skip it. The bot writes the matching column here for every
-- event, live or not.
--
-- Everything per stream (recent lists, session totals, top cheerer) still
-- comes from stream_events for the current stream; see liveLabels in
-- @repo/twitch-assets. Overlays load this row once over HTTP and then keep it
-- current from the raw events they already get over ws-server.
--
-- Each column holds a LabelEntry (@repo/schemas stream-labels):
--   { kind, id, login, name, amount?, tier?, months?, message?, reward?, active?, at }

CREATE TABLE public.stream_labels (
  broadcaster_id        text PRIMARY KEY REFERENCES public.integrations_twitch(twitch_user_id) ON DELETE CASCADE,
  latest_follower       jsonb,
  latest_subscriber     jsonb,
  latest_new_subscriber jsonb,
  latest_resubscriber   jsonb,
  latest_gift           jsonb,
  latest_cheer          jsonb,
  latest_raid           jsonb,
  latest_redemption     jsonb,
  latest_shoutout       jsonb,
  latest_hype_train     jsonb,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.stream_labels IS
  'Latest follower/sub/gift/cheer/raid/... per streamer for the overlay Label widget. Written by the bot, live or offline.';

ALTER TABLE public.stream_labels ENABLE ROW LEVEL SECURITY;

-- Owners can read their own row. Only the service role (the bot, the overlay
-- route) writes; it bypasses RLS, so there is deliberately no write policy.
CREATE POLICY "Owners read own stream labels"
  ON public.stream_labels FOR SELECT
  USING (public.user_owns_channel(broadcaster_id));

-- ---------------------------------------------------------------------------
-- get_label_period_leaders: top 10 cheerers today / this week / this month /
-- this year / all time, for the Label widget's time filter. Calendar periods
-- in UTC, weeks from Monday (date_trunc('week')). One pass over the
-- broadcaster's cheers, which are few rows compared with the whole log.
--
-- Anonymous cheers are skipped. SECURITY INVOKER: an authenticated dashboard
-- read goes through stream_events RLS; the overlay route uses the service role.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_label_period_leaders(p_broadcaster_id text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = 'public'
AS $$
  WITH bounds AS (
    SELECT
      date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS day_start,
      date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS week_start,
      date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS month_start,
      date_trunc('year', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' AS year_start
  ),
  cheers AS (
    SELECT
      e.event_data->>'user_id' AS id,
      e.event_data->>'user_login' AS login,
      coalesce(e.event_data->>'user_name', e.event_data->>'user_login', e.event_data->>'user_id') AS name,
      coalesce((e.event_data->>'bits')::bigint, 0) AS bits,
      e.created_at
    FROM stream_events e
    WHERE e.broadcaster_id = p_broadcaster_id
      AND e.event_type = 'channel.cheer'
      AND NOT coalesce((e.event_data->>'is_anonymous')::boolean, false)
      AND e.event_data->>'user_id' IS NOT NULL
  ),
  totals AS (
    SELECT
      c.id,
      (array_agg(c.login ORDER BY c.created_at DESC))[1] AS login,
      (array_agg(c.name ORDER BY c.created_at DESC))[1] AS name,
      min(c.created_at) AS first_at,
      coalesce(sum(c.bits) FILTER (WHERE c.created_at >= b.day_start), 0) AS "day",
      coalesce(sum(c.bits) FILTER (WHERE c.created_at >= b.week_start), 0) AS "week",
      coalesce(sum(c.bits) FILTER (WHERE c.created_at >= b.month_start), 0) AS "month",
      coalesce(sum(c.bits) FILTER (WHERE c.created_at >= b.year_start), 0) AS "year",
      sum(c.bits) AS "all"
    FROM cheers c CROSS JOIN bounds b
    GROUP BY c.id
  )
  SELECT jsonb_build_object(
    'day', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'login', login, 'name', name, 'amount', "day")
                     ORDER BY "day" DESC, first_at), '[]'::jsonb)
             FROM (SELECT * FROM totals WHERE "day" > 0 ORDER BY "day" DESC, first_at LIMIT 10) t),
    'week', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'login', login, 'name', name, 'amount', "week")
                     ORDER BY "week" DESC, first_at), '[]'::jsonb)
             FROM (SELECT * FROM totals WHERE "week" > 0 ORDER BY "week" DESC, first_at LIMIT 10) t),
    'month', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'login', login, 'name', name, 'amount', "month")
                     ORDER BY "month" DESC, first_at), '[]'::jsonb)
             FROM (SELECT * FROM totals WHERE "month" > 0 ORDER BY "month" DESC, first_at LIMIT 10) t),
    'year', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'login', login, 'name', name, 'amount', "year")
                     ORDER BY "year" DESC, first_at), '[]'::jsonb)
             FROM (SELECT * FROM totals WHERE "year" > 0 ORDER BY "year" DESC, first_at LIMIT 10) t),
    'all', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'login', login, 'name', name, 'amount', "all")
                     ORDER BY "all" DESC, first_at), '[]'::jsonb)
             FROM (SELECT * FROM totals WHERE "all" > 0 ORDER BY "all" DESC, first_at LIMIT 10) t)
  );
$$;

REVOKE ALL ON FUNCTION public.get_label_period_leaders(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_label_period_leaders(text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Backfill (one-off): the newest matching stream_events row per column.
-- ---------------------------------------------------------------------------

CREATE FUNCTION pg_temp.label_entry(p_type text, d jsonb, p_at timestamptz)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT jsonb_strip_nulls(CASE p_type
    WHEN 'channel.follow' THEN jsonb_build_object(
      'kind', 'follow', 'id', d->>'user_id', 'login', d->>'user_login', 'name', d->>'user_name')
    WHEN 'channel.subscribe' THEN jsonb_build_object(
      'kind', 'sub', 'id', d->>'user_id', 'login', d->>'user_login', 'name', d->>'user_name',
      'tier', d->>'tier', 'months', 1)
    WHEN 'channel.subscription.message' THEN jsonb_build_object(
      'kind', 'resub', 'id', d->>'user_id', 'login', d->>'user_login', 'name', d->>'user_name',
      'tier', d->>'tier', 'months', (d->>'cumulative_months')::int, 'message', d#>>'{message,text}')
    WHEN 'channel.subscription.gift' THEN jsonb_build_object(
      'kind', 'gift',
      'id', CASE WHEN (d->>'is_anonymous')::boolean THEN NULL ELSE d->>'user_id' END,
      'login', CASE WHEN (d->>'is_anonymous')::boolean THEN NULL ELSE d->>'user_login' END,
      'name', CASE WHEN (d->>'is_anonymous')::boolean THEN 'Anonymous' ELSE coalesce(d->>'user_name', 'Anonymous') END,
      'tier', d->>'tier', 'amount', coalesce((d->>'total')::int, 1))
    WHEN 'channel.cheer' THEN jsonb_build_object(
      'kind', 'cheer',
      'id', CASE WHEN (d->>'is_anonymous')::boolean THEN NULL ELSE d->>'user_id' END,
      'login', CASE WHEN (d->>'is_anonymous')::boolean THEN NULL ELSE d->>'user_login' END,
      'name', CASE WHEN (d->>'is_anonymous')::boolean THEN 'Anonymous' ELSE coalesce(d->>'user_name', 'Anonymous') END,
      'amount', coalesce((d->>'bits')::int, 0), 'message', d->>'message')
    WHEN 'channel.raid' THEN jsonb_build_object(
      'kind', 'raid', 'id', d->>'from_broadcaster_user_id', 'login', d->>'from_broadcaster_user_login',
      'name', d->>'from_broadcaster_user_name', 'amount', coalesce((d->>'viewers')::int, 0))
    WHEN 'channel.channel_points_custom_reward_redemption.add' THEN jsonb_build_object(
      'kind', 'redemption', 'id', d->>'user_id', 'login', d->>'user_login', 'name', d->>'user_name',
      'reward', d#>>'{reward,title}', 'amount', (d#>>'{reward,cost}')::int, 'message', d->>'user_input')
    WHEN 'channel.shoutout.receive' THEN jsonb_build_object(
      'kind', 'shoutout', 'id', d->>'from_broadcaster_user_id', 'login', d->>'from_broadcaster_user_login',
      'name', d->>'from_broadcaster_user_name', 'amount', (d->>'viewer_count')::int)
    WHEN 'channel.hype_train.end' THEN jsonb_build_object(
      'kind', 'hype_train', 'name', 'Hype train', 'amount', coalesce((d->>'level')::int, 1), 'active', false)
  END || jsonb_build_object('at', p_at));
$$;

CREATE TEMP TABLE label_backfill AS
SELECT DISTINCT ON (e.broadcaster_id, col)
  e.broadcaster_id,
  col,
  pg_temp.label_entry(e.event_type, e.event_data, e.created_at) AS entry
FROM public.stream_events e
JOIN public.integrations_twitch i ON i.twitch_user_id = e.broadcaster_id
CROSS JOIN LATERAL (
  SELECT unnest(CASE e.event_type
    WHEN 'channel.follow' THEN ARRAY['latest_follower']
    -- Gift recipients are covered by the gift itself.
    WHEN 'channel.subscribe' THEN
      CASE WHEN coalesce((e.event_data->>'is_gift')::boolean, false) THEN ARRAY[]::text[]
           ELSE ARRAY['latest_subscriber', 'latest_new_subscriber'] END
    WHEN 'channel.subscription.message' THEN ARRAY['latest_subscriber', 'latest_resubscriber']
    WHEN 'channel.subscription.gift' THEN ARRAY['latest_gift']
    WHEN 'channel.cheer' THEN ARRAY['latest_cheer']
    WHEN 'channel.raid' THEN
      CASE WHEN e.event_data->>'to_broadcaster_user_id' = e.broadcaster_id THEN ARRAY['latest_raid'] ELSE ARRAY[]::text[] END
    WHEN 'channel.channel_points_custom_reward_redemption.add' THEN ARRAY['latest_redemption']
    WHEN 'channel.shoutout.receive' THEN ARRAY['latest_shoutout']
    WHEN 'channel.hype_train.end' THEN ARRAY['latest_hype_train']
    ELSE ARRAY[]::text[]
  END) AS col
) c
ORDER BY e.broadcaster_id, col, e.created_at DESC;

INSERT INTO public.stream_labels (
  broadcaster_id, latest_follower, latest_subscriber, latest_new_subscriber, latest_resubscriber,
  latest_gift, latest_cheer, latest_raid, latest_redemption, latest_shoutout, latest_hype_train
)
SELECT
  broadcaster_id,
  max(entry::text) FILTER (WHERE col = 'latest_follower')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_subscriber')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_new_subscriber')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_resubscriber')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_gift')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_cheer')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_raid')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_redemption')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_shoutout')::jsonb,
  max(entry::text) FILTER (WHERE col = 'latest_hype_train')::jsonb
FROM label_backfill
GROUP BY broadcaster_id
ON CONFLICT (broadcaster_id) DO NOTHING;

DROP TABLE label_backfill;
DROP FUNCTION pg_temp.label_entry(text, jsonb, timestamptz);
