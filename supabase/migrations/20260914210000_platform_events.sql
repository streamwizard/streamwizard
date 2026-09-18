-- Platform event log (SW-334, SW-352). One row per thing that happens on the
-- platform (new user, Discord linked, account deleted, plan granted, ...).
-- The table doubles as a delivery queue: the Discord bot claims pending rows,
-- posts them to the log channel and marks them delivered, so nothing is lost
-- while the bot is offline. Staff browse the same rows in web-admin.
--
-- event_type is plain text with a format check. The list of types lives in
-- @repo/types (platform-events.ts), so adding one needs no migration.
--
-- PII: payloads hold Twitch username/id and Discord user id and name. No
-- emails. Discord server events (message.*) also hold message text, which is
-- purged after 30 days (20260915090000_server_log_retention.sql).

CREATE TABLE "public"."platform_events" (
    "id" bigint GENERATED ALWAYS AS IDENTITY,
    "event_type" text NOT NULL,
    -- Who did it (an admin granting a plan). NULL for self-service events.
    "actor_user_id" uuid,
    -- Who it is about. No FK: rows outlive a deleted account.
    "subject_user_id" uuid,
    "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "status" text NOT NULL DEFAULT 'pending',
    "attempts" integer NOT NULL DEFAULT 0,
    "next_attempt_at" timestamptz NOT NULL DEFAULT now(),
    "locked_until" timestamptz,
    "delivered_at" timestamptz,
    "discord_message_id" text,
    -- Last delivery error, or why the event was skipped.
    "last_error" text,
    CONSTRAINT "platform_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "platform_events_event_type_check" CHECK ("event_type" ~ '^[a-z_]+\.[a-z_]+$'),
    CONSTRAINT "platform_events_status_check" CHECK ("status" IN ('pending', 'delivered', 'skipped', 'failed'))
);

ALTER TABLE "public"."platform_events" OWNER TO "postgres";

CREATE INDEX "platform_events_created_idx" ON "public"."platform_events" ("created_at" DESC);
CREATE INDEX "platform_events_type_created_idx" ON "public"."platform_events" ("event_type", "created_at" DESC);
CREATE INDEX "platform_events_pending_idx" ON "public"."platform_events" ("next_attempt_at") WHERE "status" = 'pending';
-- Account deletion strips a user's rows; the token-refresh dedupe looks for a recent row per user.
CREATE INDEX "platform_events_subject_idx" ON "public"."platform_events" ("subject_user_id", "event_type", "created_at" DESC)
    WHERE "subject_user_id" IS NOT NULL;

ALTER TABLE "public"."platform_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read platform events" ON "public"."platform_events"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."platform_events" TO "service_role";
GRANT SELECT ON TABLE "public"."platform_events" TO "authenticated";

-- The bot listens for inserts to deliver right away instead of waiting for
-- its catch-up poll.
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."platform_events";

-- Log channel settings for the single StreamWizard guild.
--   log_channel_id           default channel for every event type
--   log_ignored_channel_ids  message events in these channels (or channels
--                            inside these categories) aren't logged
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN IF NOT EXISTS "log_channel_id" text,
    ADD COLUMN IF NOT EXISTS "log_ignored_channel_ids" text[] NOT NULL DEFAULT '{}';

-- Per-event overrides. No row means the type's default from @repo/types
-- (on or off) and the default channel, so new event types need no migration.
CREATE TABLE "public"."discord_log_event_settings" (
    "guild_id" text NOT NULL,
    "event_type" text NOT NULL,
    "enabled" boolean NOT NULL,
    -- NULL: post to the default log channel.
    "channel_id" text,
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_log_event_settings_pkey" PRIMARY KEY ("guild_id", "event_type"),
    CONSTRAINT "discord_log_event_settings_event_type_check" CHECK ("event_type" ~ '^[a-z_]+\.[a-z_]+$')
);

ALTER TABLE "public"."discord_log_event_settings" OWNER TO "postgres";
ALTER TABLE "public"."discord_log_event_settings" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read discord log event settings" ON "public"."discord_log_event_settings"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."discord_log_event_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_log_event_settings" TO "authenticated";

-- Emit from SQL (triggers, RPCs) and, through PostgREST, from TypeScript.
-- Never raises: a lost log row must not fail a signup or an account deletion.
-- Returns NULL when the insert failed.
CREATE OR REPLACE FUNCTION public.emit_platform_event(
    p_event_type text,
    p_subject_user_id uuid DEFAULT NULL,
    p_actor_user_id uuid DEFAULT NULL,
    p_payload jsonb DEFAULT '{}'::jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_id bigint;
BEGIN
  INSERT INTO public.platform_events (event_type, subject_user_id, actor_user_id, payload)
  VALUES (p_event_type, p_subject_user_id, p_actor_user_id, COALESCE(p_payload, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'emit_platform_event(%) failed: %', p_event_type, SQLERRM;
    RETURN NULL;
END;
$$;

ALTER FUNCTION public.emit_platform_event(text, uuid, uuid, jsonb) OWNER TO "postgres";

-- The SubjectIdentity payload for a user: Twitch login and id, Discord id,
-- avatar. display_name only when there's no Twitch account and the name isn't
-- an email. Never emails. Every SQL emitter builds on this; the exception is
-- handle_new_user, which runs before the integration rows exist.
CREATE OR REPLACE FUNCTION public.platform_event_identity(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object(
    'twitch_username', t.twitch_username,
    'twitch_user_id', t.twitch_user_id,
    'discord_user_id', d.discord_user_id,
    'avatar_url', COALESCE(t.profile_image_url, u.avatar_url),
    'display_name', CASE WHEN t.user_id IS NULL AND u.name IS NOT NULL AND position('@' in u.name) = 0 THEN u.name END
  ))
  FROM (SELECT p_user_id AS id) AS x
  LEFT JOIN public.users u ON u.id = x.id
  LEFT JOIN public.integrations_twitch t ON t.user_id = x.id
  LEFT JOIN public.integrations_discord d ON d.user_id = x.id;
$$;

ALTER FUNCTION public.platform_event_identity(uuid) OWNER TO "postgres";

-- Removes user-written text from a stored payload (retention, account
-- deletion) and marks it, so the same row isn't scanned again.
CREATE OR REPLACE FUNCTION public.strip_platform_event_text(p_payload jsonb, p_keys text[])
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT (p_payload - p_keys) || '{"text_purged": true}'::jsonb;
$$;

ALTER FUNCTION public.strip_platform_event_text(jsonb, text[]) OWNER TO "postgres";

-- Claims up to p_limit due events for delivery. The lease stops a second
-- drain from picking the same rows; if the bot dies mid-delivery the lease
-- runs out and the row is claimed again.
CREATE OR REPLACE FUNCTION public.claim_platform_events(p_limit integer, p_lease_seconds integer)
RETURNS SETOF public.platform_events
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT id FROM public.platform_events
    WHERE status = 'pending'
      AND next_attempt_at <= now()
      AND (locked_until IS NULL OR locked_until < now())
    ORDER BY id
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.platform_events e
  SET locked_until = now() + make_interval(secs => p_lease_seconds),
      attempts = e.attempts + 1
  FROM due
  WHERE e.id = due.id
  RETURNING e.*;
END;
$$;

ALTER FUNCTION public.claim_platform_events(integer, integer) OWNER TO "postgres";

-- Records the outcome of one delivery attempt.
--   delivered / skipped: final.
--   failed: retried with exponential backoff (5s, 10s, 20s, ... capped at
--   30 min) until p_max_attempts, then left as failed.
CREATE OR REPLACE FUNCTION public.complete_platform_event(
    p_id bigint,
    p_status text,
    p_discord_message_id text DEFAULT NULL,
    p_error text DEFAULT NULL,
    p_max_attempts integer DEFAULT 12
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF p_status IN ('delivered', 'skipped') THEN
    UPDATE public.platform_events
    SET status = p_status,
        delivered_at = now(),
        discord_message_id = p_discord_message_id,
        last_error = p_error,
        locked_until = NULL
    WHERE id = p_id;
  ELSIF p_status = 'failed' THEN
    UPDATE public.platform_events
    SET status = CASE WHEN attempts >= p_max_attempts THEN 'failed' ELSE 'pending' END,
        next_attempt_at = now() + LEAST(
          make_interval(secs => 5 * power(2, GREATEST(attempts - 1, 0))),
          interval '30 minutes'
        ),
        last_error = left(p_error, 1000),
        locked_until = NULL
    WHERE id = p_id;
  ELSE
    RAISE EXCEPTION 'Unknown platform event status: %', p_status;
  END IF;
END;
$$;

ALTER FUNCTION public.complete_platform_event(bigint, text, text, text, integer) OWNER TO "postgres";

-- The bot runs as a single instance, so any lease left at startup belongs to
-- a process that died. Releasing them delivers those rows straight away
-- instead of after the lease runs out.
CREATE OR REPLACE FUNCTION public.release_platform_event_locks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.platform_events SET locked_until = NULL
  WHERE status = 'pending' AND locked_until IS NOT NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

ALTER FUNCTION public.release_platform_event_locks() OWNER TO "postgres";

REVOKE ALL ON FUNCTION public.emit_platform_event(text, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.platform_event_identity(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.strip_platform_event_text(jsonb, text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_platform_events(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_platform_event(bigint, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_platform_event_locks() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_platform_event(text, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.platform_event_identity(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_platform_events(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_platform_event(bigint, text, text, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_platform_event_locks() TO service_role;
