-- Platform events, Tier 1 (docs/platform-events-tier1-plan.md). Product and
-- staff events for the Discord log channel, on the SW-334 queue:
--   clips.sync_started / sync_completed / sync_failed   trigger on twitch_clip_syncs
--   admin.role_granted / role_revoked                     trigger on user_roles
--   feedback.submitted                                    trigger on feedback
--   twitch.token_refresh_failed                           emit_twitch_token_refresh_failed (deduped)
--   user.deleted gains a reason                           delete_user_data(p_twitch_user_id, p_reason)
-- ticket.* events are emitted by the bot. This migration moves the old ticket
-- log channel (discord_ticket_settings.log_channel_id, one embed on close)
-- into discord_log_event_settings and drops the column.
--
-- delete_user_data also closes a hole: init.sql granted EXECUTE on it to anon
-- and authenticated explicitly, and 20260611032513 only revoked it from
-- PUBLIC, so any client could call it with someone else's Twitch id.

-- ── Clip syncs ──────────────────────────────────────────────────────────────
ALTER TABLE public.twitch_clip_syncs ADD COLUMN IF NOT EXISTS last_error text;

-- last_sync is stamped with now() when a sync starts, so on completion it's
-- the start time and now() - last_sync is the duration.
CREATE OR REPLACE FUNCTION public.log_clip_sync_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_identity jsonb;
  v_duration numeric;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.sync_status IS NOT DISTINCT FROM NEW.sync_status THEN
    RETURN NEW;
  END IF;

  v_identity := public.platform_event_identity(NEW.user_id) || jsonb_build_object('sync_id', NEW.id);
  -- Only a status change on an existing row has a start time to measure from.
  IF TG_OP = 'UPDATE' THEN
    v_duration := round(extract(epoch FROM now() - NEW.last_sync));
  END IF;

  IF NEW.sync_status = 'syncing' THEN
    PERFORM public.emit_platform_event(
      'clips.sync_started', NEW.user_id, NULL,
      v_identity || jsonb_build_object('last_sync', CASE WHEN TG_OP = 'UPDATE' THEN OLD.last_sync END)
    );
  ELSIF NEW.sync_status = 'completed' THEN
    PERFORM public.emit_platform_event(
      'clips.sync_completed', NEW.user_id, NULL,
      v_identity || jsonb_build_object('clip_count', NEW.clip_count, 'duration_seconds', v_duration)
    );
  ELSIF NEW.sync_status = 'failed' THEN
    PERFORM public.emit_platform_event(
      'clips.sync_failed', NEW.user_id, NULL,
      v_identity || jsonb_build_object('duration_seconds', v_duration, 'error', NEW.last_error)
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in log_clip_sync_change: %', SQLERRM;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_clip_sync_change() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.log_clip_sync_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "on_twitch_clip_syncs_change" ON public.twitch_clip_syncs;
CREATE TRIGGER "on_twitch_clip_syncs_change"
  AFTER INSERT OR UPDATE OF sync_status ON public.twitch_clip_syncs
  FOR EACH ROW EXECUTE FUNCTION public.log_clip_sync_change();

-- ── Admin roles ─────────────────────────────────────────────────────────────
-- Roles are granted by hand in SQL today, so there's no actor.
-- delete_user_data sets streamwizard.suppress_role_event so removing the rows
-- with the account logs user.deleted only.
CREATE OR REPLACE FUNCTION public.log_user_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_row public.user_roles;
BEGIN
  -- delete_user_data removes the rows as part of the account; not a revoke.
  IF current_setting('streamwizard.suppress_role_event', true) = 'on' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  -- Only staff roles; the log labels say "Admin role".
  IF v_row.role NOT IN ('admin', 'smp_admin') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  PERFORM public.emit_platform_event(
    CASE WHEN TG_OP = 'DELETE' THEN 'admin.role_revoked' ELSE 'admin.role_granted' END,
    v_row.user_id, NULL,
    public.platform_event_identity(v_row.user_id) || jsonb_build_object('role', v_row.role)
  );
  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in log_user_role_change: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.log_user_role_change() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.log_user_role_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "on_user_roles_change" ON public.user_roles;
CREATE TRIGGER "on_user_roles_change"
  AFTER INSERT OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.log_user_role_change();

-- ── Feedback ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.log_feedback_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.emit_platform_event(
    'feedback.submitted', NEW.user_id, NULL,
    COALESCE(CASE WHEN NEW.user_id IS NOT NULL THEN public.platform_event_identity(NEW.user_id) END, '{}'::jsonb)
      || jsonb_strip_nulls(jsonb_build_object(
        'feedback_id', NEW.id,
        'title', NEW.title,
        'category', NEW.category,
        'priority', NEW.priority,
        'description', left(NEW.description, 300),
        'contact', NEW.discord
      ))
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE LOG 'Error in log_feedback_submitted: %', SQLERRM;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.log_feedback_submitted() OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.log_feedback_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS "on_feedback_submitted" ON public.feedback;
CREATE TRIGGER "on_feedback_submitted"
  AFTER INSERT ON public.feedback
  FOR EACH ROW EXECUTE FUNCTION public.log_feedback_submitted();

-- ── Twitch token refresh failures ───────────────────────────────────────────
-- A dead refresh token fails on every API call, so one event per user per
-- 6 hours. Returns the event id, or NULL when deduplicated or unknown user.
CREATE OR REPLACE FUNCTION public.emit_twitch_token_refresh_failed(
  p_twitch_user_id text,
  p_error text,
  p_status integer DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.integrations_twitch WHERE twitch_user_id = p_twitch_user_id;
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.platform_events
    WHERE event_type = 'twitch.token_refresh_failed'
      AND subject_user_id = v_user_id
      AND created_at > now() - interval '6 hours'
  ) THEN
    RETURN NULL;
  END IF;

  RETURN public.emit_platform_event(
    'twitch.token_refresh_failed', v_user_id, NULL,
    public.platform_event_identity(v_user_id)
      || jsonb_strip_nulls(jsonb_build_object('error', left(p_error, 500), 'status', p_status))
  );
END;
$$;

ALTER FUNCTION public.emit_twitch_token_refresh_failed(text, text, integer) OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.emit_twitch_token_refresh_failed(text, text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_twitch_token_refresh_failed(text, text, integer) TO service_role;

-- ── Account deletion: reason, and user-written text on log rows ─────────────
-- Same body as 20260914211000_platform_event_emitters.sql plus:
--   p_reason        'requested' (delete-account action) or 'twitch_revoked'
--                   (user.authorization.revoke webhook), into the event payload
--   text strip      feedback description and ticket subject on this user's
--                   events go now, like message text
-- A new parameter list is a new overload, so the old one is dropped first.
DROP FUNCTION IF EXISTS public.delete_user_data(text);

CREATE FUNCTION public.delete_user_data(p_twitch_user_id text, p_reason text DEFAULT 'requested')
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
  SET payload = public.strip_platform_event_text(payload, ARRAY['description', 'subject', 'contact'])
  WHERE subject_user_id = v_user_id
    AND payload ?| ARRAY['description', 'subject', 'contact'];

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
        subject = 'Removed', description = ''
    WHERE opener_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET claimed_by_discord_user_id = NULL, claimed_by_name = 'Deleted user'
    WHERE claimed_by_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET closed_by_discord_user_id = NULL, closed_by_name = 'Deleted user'
    WHERE closed_by_discord_user_id = v_discord_user_id;
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

ALTER FUNCTION public.delete_user_data(text, text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.delete_user_data(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(text, text) TO service_role;

-- ── Ticket log channel moves to the log settings ────────────────────────────
-- The old log posted one embed per close, so the channel staff picked becomes
-- the per-type channel for ticket.closed only; opened, claimed and replied
-- follow the default log channel. An existing per-type row wins.
INSERT INTO public.discord_log_event_settings (guild_id, event_type, enabled, channel_id)
SELECT s.guild_id, 'ticket.closed', true, s.log_channel_id
FROM public.discord_ticket_settings s
WHERE s.log_channel_id IS NOT NULL
ON CONFLICT (guild_id, event_type) DO NOTHING;

ALTER TABLE public.discord_ticket_settings DROP COLUMN IF EXISTS log_channel_id;
