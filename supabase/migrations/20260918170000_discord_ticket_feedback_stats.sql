-- Opener feedback and the numbers behind the stats page.
--
-- When a ticket closes, the opener's DM carries five rating buttons (when the
-- category allows it) and an optional comment. One rating per ticket, from
-- the opener only, claimed with a conditional UPDATE in the bot. The comment
-- is free text the opener wrote, so it goes with their account and with the
-- 12-month transcript purge.
--
-- The three ticket_stats_* functions are the only aggregate reads: opened
-- and closed counts, response and resolution times, ratings. They are
-- SECURITY DEFINER for service_role only, like the rest of the ticket RPCs.

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "feedback_rating" smallint,
    ADD COLUMN IF NOT EXISTS "feedback_comment" text,
    ADD COLUMN IF NOT EXISTS "feedback_at" timestamptz;

ALTER TABLE "public"."discord_tickets"
    ADD CONSTRAINT "discord_tickets_feedback_rating_check"
    CHECK ("feedback_rating" IS NULL OR "feedback_rating" BETWEEN 1 AND 5);

ALTER TABLE "public"."discord_ticket_categories"
    ADD COLUMN IF NOT EXISTS "feedback_enabled" boolean NOT NULL DEFAULT true;

-- The stats page groups by day and by category over a date range.
CREATE INDEX IF NOT EXISTS "discord_tickets_guild_created_idx"
    ON "public"."discord_tickets" ("guild_id", "created_at");
CREATE INDEX IF NOT EXISTS "discord_tickets_guild_closed_idx"
    ON "public"."discord_tickets" ("guild_id", "closed_at")
    WHERE "closed_at" IS NOT NULL;

CREATE OR REPLACE FUNCTION public.ticket_stats_summary(p_guild_id text, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (
    opened bigint,
    closed bigint,
    avg_first_response_seconds double precision,
    avg_resolution_seconds double precision,
    avg_rating double precision,
    rating_count bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
    SELECT
        (SELECT count(*) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.created_at >= p_from AND t.created_at < p_to),
        (SELECT count(*) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.closed_at >= p_from AND t.closed_at < p_to),
        (SELECT avg(extract(epoch FROM (t.first_response_at - t.created_at))) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.created_at >= p_from AND t.created_at < p_to
            AND t.first_response_at IS NOT NULL),
        (SELECT avg(extract(epoch FROM (t.closed_at - t.created_at))) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.closed_at >= p_from AND t.closed_at < p_to),
        (SELECT avg(t.feedback_rating) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.feedback_at >= p_from AND t.feedback_at < p_to),
        (SELECT count(t.feedback_rating) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.feedback_at >= p_from AND t.feedback_at < p_to);
$$;

CREATE OR REPLACE FUNCTION public.ticket_stats_by_day(p_guild_id text, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (day date, opened bigint, closed bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
    SELECT
        d::date AS day,
        (SELECT count(*) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.created_at >= d AND t.created_at < d + interval '1 day'),
        (SELECT count(*) FROM public.discord_tickets t
          WHERE t.guild_id = p_guild_id AND t.closed_at >= d AND t.closed_at < d + interval '1 day')
    FROM generate_series(date_trunc('day', p_from), date_trunc('day', p_to - interval '1 second'), interval '1 day') AS d
    ORDER BY d;
$$;

CREATE OR REPLACE FUNCTION public.ticket_stats_by_category(p_guild_id text, p_from timestamptz, p_to timestamptz)
RETURNS TABLE (category text, opened bigint, closed bigint, avg_rating double precision, rating_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
    SELECT
        t.category,
        count(*) FILTER (WHERE t.created_at >= p_from AND t.created_at < p_to),
        count(*) FILTER (WHERE t.closed_at >= p_from AND t.closed_at < p_to),
        avg(t.feedback_rating) FILTER (WHERE t.feedback_at >= p_from AND t.feedback_at < p_to),
        count(t.feedback_rating) FILTER (WHERE t.feedback_at >= p_from AND t.feedback_at < p_to)
    FROM public.discord_tickets t
    WHERE t.guild_id = p_guild_id
      AND ((t.created_at >= p_from AND t.created_at < p_to)
        OR (t.closed_at >= p_from AND t.closed_at < p_to)
        OR (t.feedback_at >= p_from AND t.feedback_at < p_to))
    GROUP BY t.category
    ORDER BY 2 DESC, t.category;
$$;

DO $$
DECLARE fn text;
BEGIN
    FOREACH fn IN ARRAY ARRAY['ticket_stats_summary', 'ticket_stats_by_day', 'ticket_stats_by_category'] LOOP
        EXECUTE format('ALTER FUNCTION public.%I(text, timestamptz, timestamptz) OWNER TO postgres', fn);
        EXECUTE format('REVOKE ALL ON FUNCTION public.%I(text, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated', fn);
        EXECUTE format('GRANT EXECUTE ON FUNCTION public.%I(text, timestamptz, timestamptz) TO service_role', fn);
    END LOOP;
END $$;

-- Retention: the feedback comment is the opener's text and goes with the transcript.
-- Same body as 20260918120000_discord_ticket_forms.sql plus feedback_comment.
CREATE OR REPLACE FUNCTION public.purge_old_discord_ticket_transcripts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    SELECT id FROM public.discord_tickets
    WHERE status = 'closed'
      AND closed_at < now() - interval '12 months'
      AND transcript_purged_at IS NULL
  ), purged_messages AS (
    DELETE FROM public.discord_ticket_messages WHERE ticket_id IN (SELECT id FROM expired)
  ), purged_events AS (
    DELETE FROM public.discord_ticket_events WHERE ticket_id IN (SELECT id FROM expired)
  ), purged_answers AS (
    DELETE FROM public.discord_ticket_answers WHERE ticket_id IN (SELECT id FROM expired)
  )
  UPDATE public.discord_tickets
  SET transcript_purged_at = now(), close_reason = NULL, feedback_comment = NULL
  WHERE id IN (SELECT id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Account deletion. Same body as 20260918130000_discord_ticket_lifecycle.sql
-- plus what tickets have grown since: the feedback comment on tickets they
-- opened, the close reason they wrote as closer, the pending close request
-- they made, and the comment text on their ticket.feedback log events.
CREATE OR REPLACE FUNCTION public.delete_user_data(p_twitch_user_id text, p_reason text DEFAULT 'requested')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_discord_user_id text;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.integrations_twitch
  WHERE twitch_user_id = p_twitch_user_id;

  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Read the Discord id before the integration rows go.
  SELECT discord_user_id INTO v_discord_user_id
  FROM public.integrations_discord
  WHERE user_id = v_user_id;

  PERFORM public.emit_platform_event(
    'user.deleted', v_user_id, NULL,
    public.platform_event_identity(v_user_id) || jsonb_build_object(
      'reason', CASE WHEN p_reason IN ('requested', 'twitch_revoked') THEN p_reason ELSE 'requested' END
    )
  );

  -- Server log (message.* events): drop the text of their messages now
  -- instead of waiting for the 30-day purge. Bulk-delete lines ('lines')
  -- aren't tied to one author and go with the purge.
  IF v_discord_user_id IS NOT NULL THEN
    UPDATE public.platform_events
    SET payload = public.strip_platform_event_text(payload, ARRAY['content', 'before', 'after'])
    WHERE event_type LIKE 'message.%'
      AND payload->>'discord_user_id' = v_discord_user_id
      AND NOT (payload ? 'text_purged');
  END IF;

  -- Feedback and ticket events: the text they wrote goes too.
  UPDATE public.platform_events
  SET payload = public.strip_platform_event_text(payload, ARRAY['description', 'subject', 'contact', 'comment'])
  WHERE subject_user_id = v_user_id
    AND payload ?| ARRAY['description', 'subject', 'contact', 'comment'];

  -- The integrations delete below cascades to integrations_discord; that is
  -- part of this deletion, not a separate unlink. Transaction-local.
  PERFORM set_config('streamwizard.suppress_discord_unlink_event', 'on', true);

  -- Discord ticket history (SW-351): anonymise rather than delete, so staff
  -- replies and the timeline still make sense.
  IF v_discord_user_id IS NOT NULL THEN
    UPDATE public.discord_ticket_messages
    SET author_discord_id = NULL, author_name = 'Deleted user', author_avatar_url = NULL,
        content = '', embeds = '[]'::jsonb, attachments = '[]'::jsonb
    WHERE author_discord_id = v_discord_user_id;

    UPDATE public.discord_ticket_events
    SET actor_discord_id = NULL, actor_name = 'Deleted user'
    WHERE actor_discord_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET opener_discord_user_id = 'deleted', opener_name = 'Deleted user',
        subject = 'Removed', description = '', close_reason = NULL, feedback_comment = NULL
    WHERE opener_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET claimed_by_discord_user_id = NULL, claimed_by_name = 'Deleted user'
    WHERE claimed_by_discord_user_id = v_discord_user_id;

    -- The close reason is the closer's own words.
    UPDATE public.discord_tickets
    SET closed_by_discord_user_id = NULL, closed_by_name = 'Deleted user', close_reason = NULL
    WHERE closed_by_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET close_requested_by = NULL
    WHERE close_requested_by = v_discord_user_id;

    DELETE FROM public.discord_ticket_members WHERE discord_user_id = v_discord_user_id;

    UPDATE public.discord_ticket_members SET added_by_discord_user_id = NULL
    WHERE added_by_discord_user_id = v_discord_user_id;

    UPDATE public.discord_ticket_events
    SET target_discord_id = NULL, target_name = 'Deleted user'
    WHERE target_discord_id = v_discord_user_id;
  END IF;

  DELETE FROM public.clip_folder_junction WHERE user_id = v_user_id;
  DELETE FROM public.pending_clips WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.twitch_clip_syncs WHERE user_id = v_user_id;
  DELETE FROM public.stream_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.stream_viewer_counts WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.broadcaster_live_status WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.overlay_widget_instances WHERE user_id = v_user_id;
  DELETE FROM public.overlay_items WHERE scene_id IN (
    SELECT id FROM public.overlay_scenes WHERE user_id = v_user_id
  );
  DELETE FROM public.overlay_scenes WHERE user_id = v_user_id;
  DELETE FROM public.overlay_widget_library_entries WHERE user_id = v_user_id;
  DELETE FROM public.overlay_widgets WHERE user_id = v_user_id;
  DELETE FROM public.commands WHERE channel_id = p_twitch_user_id;
  -- clips must be deleted before vods: clips_video_id_fkey references vods.video_id.
  DELETE FROM public.clips WHERE user_id = v_user_id;
  DELETE FROM public.vods WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.clip_folders WHERE user_id = v_user_id;
  DELETE FROM public.testimonials WHERE user_id = v_user_id;
  DELETE FROM public.feedback WHERE user_id = v_user_id;
  DELETE FROM public.system_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.irl_geo_track WHERE user_id = v_user_id;
  DELETE FROM public.user_state_definitions WHERE user_id = v_user_id;
  DELETE FROM public.user_states WHERE user_id = v_user_id;
  -- user_roles rows go with the account; that isn't a revoke, so no event.
  PERFORM set_config('streamwizard.suppress_role_event', 'on', true);
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;
