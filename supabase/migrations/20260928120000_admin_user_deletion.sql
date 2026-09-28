-- web-admin's /users page can delete an account (reason 'admin'). The
-- user.deleted event now names the admin: an optional p_actor_user_id sets
-- actor_user_id and the actor fields in the payload. Existing callers
-- (self-delete, Twitch revoke) pass named args and don't change.
--
-- A new parameter is a new signature, so the (text, text) version is dropped
-- first rather than left as an ambiguous overload. Body otherwise unchanged
-- from 20260918130000_discord_ticket_lifecycle.sql.

DROP FUNCTION IF EXISTS public.delete_user_data(text, text);

CREATE FUNCTION public.delete_user_data(
  p_twitch_user_id text,
  p_reason text DEFAULT 'requested',
  p_actor_user_id uuid DEFAULT NULL
)
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
    'user.deleted', v_user_id, p_actor_user_id,
    public.platform_event_identity(v_user_id) || jsonb_build_object(
      'reason', CASE WHEN p_reason IN ('requested', 'twitch_revoked', 'admin') THEN p_reason ELSE 'requested' END
    ) || CASE
      WHEN p_actor_user_id IS NULL THEN '{}'::jsonb
      ELSE jsonb_build_object(
        'actor_twitch_username', (SELECT twitch_username FROM public.integrations_twitch WHERE user_id = p_actor_user_id),
        'actor_avatar_url', (SELECT profile_image_url FROM public.integrations_twitch WHERE user_id = p_actor_user_id)
      )
    END
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

    UPDATE public.discord_tickets SET close_reason = NULL
    WHERE opener_discord_user_id = 'deleted' AND close_reason IS NOT NULL;

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

ALTER FUNCTION public.delete_user_data(text, text, uuid) OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.delete_user_data(text, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(text, text, uuid) TO service_role;
