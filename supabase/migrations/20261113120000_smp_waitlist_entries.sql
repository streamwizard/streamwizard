-- Waitlist for the StreamWizard Minecraft SMP: one row per account, filled in
-- from the sign-up stepper on /smp.
--
-- Users only read their own row. Every write comes from the web app's server
-- action with the service role, after it has checked the session, the Discord
-- steps and the Minecraft account (the name is resolved to its UUID on the
-- server, and the Twitch columns are a snapshot taken at that moment). So
-- there is no insert, update or delete policy on purpose, and the status
-- column can only be changed by staff tooling.

CREATE TABLE public.smp_waitlist_entries (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending',
  minecraft_username text NOT NULL,
  minecraft_uuid uuid NOT NULL,
  average_viewers integer NOT NULL,
  stream_language text NOT NULL,
  stream_frequency text NOT NULL,
  twitch_broadcaster_type text,
  twitch_follower_count integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT smp_waitlist_entries_pkey PRIMARY KEY (user_id),
  CONSTRAINT smp_waitlist_entries_minecraft_uuid_key UNIQUE (minecraft_uuid),
  CONSTRAINT smp_waitlist_entries_status_check CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT smp_waitlist_entries_minecraft_username_check CHECK (minecraft_username ~ '^[A-Za-z0-9_]{3,16}$'),
  CONSTRAINT smp_waitlist_entries_average_viewers_check CHECK (average_viewers BETWEEN 0 AND 1000000),
  CONSTRAINT smp_waitlist_entries_stream_language_check CHECK (stream_language ~ '^[a-z]{2,8}(-[a-z]{2,8})?$'),
  CONSTRAINT smp_waitlist_entries_stream_frequency_check
    CHECK (stream_frequency IN ('most_days', 'few_per_week', 'weekly', 'less_than_weekly')),
  CONSTRAINT smp_waitlist_entries_twitch_broadcaster_type_check
    CHECK (twitch_broadcaster_type IS NULL OR twitch_broadcaster_type IN ('none', 'affiliate', 'partner')),
  CONSTRAINT smp_waitlist_entries_twitch_follower_count_check
    CHECK (twitch_follower_count IS NULL OR twitch_follower_count >= 0)
);

-- Review order: oldest pending application first.
CREATE INDEX smp_waitlist_entries_status_created_at_idx
  ON public.smp_waitlist_entries (status, created_at);

ALTER TABLE public.smp_waitlist_entries ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.smp_waitlist_entries FROM anon, authenticated;
GRANT SELECT ON TABLE public.smp_waitlist_entries TO authenticated;
GRANT ALL ON TABLE public.smp_waitlist_entries TO service_role;

CREATE POLICY "smp_waitlist_entries_select_own" ON public.smp_waitlist_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING ((( SELECT auth.uid()) = user_id));

CREATE OR REPLACE TRIGGER smp_waitlist_entries_updated_at
  BEFORE UPDATE ON public.smp_waitlist_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Account deletion. The FK cascade covers a deleted auth user, but the Twitch
-- authorization-revoke path calls delete_user_data directly, and that function
-- lists its tables by hand. Body otherwise unchanged from
-- 20261025120000_keep_shared_clips_on_user_delete.sql.

CREATE OR REPLACE FUNCTION public.delete_user_data(
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
        subject = 'Removed', description = '', close_reason = NULL, feedback_comment = NULL,
        references_message_url = NULL
    WHERE opener_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET claimed_by_discord_user_id = NULL, claimed_by_name = 'Deleted user'
    WHERE claimed_by_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET closed_by_discord_user_id = NULL, closed_by_name = 'Deleted user', close_reason = NULL
    WHERE closed_by_discord_user_id = v_discord_user_id;

    UPDATE public.discord_tickets
    SET close_requested_by = NULL
    WHERE close_requested_by = v_discord_user_id;

    UPDATE public.discord_tickets
    SET created_by_discord_user_id = NULL
    WHERE created_by_discord_user_id = v_discord_user_id;

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
  -- SW-107: clips other users filed in their folders stay, detached from this
  -- account. Their VOD goes below, so the link to it goes too.
  UPDATE public.clips c
  SET user_id = NULL, video_id = NULL, vod_offset = NULL
  WHERE c.user_id = v_user_id
    AND EXISTS (
      SELECT 1 FROM public.clip_folder_junction cfj
      WHERE cfj.clip_id = c.twitch_clip_id AND cfj.user_id <> v_user_id
    );
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
  DELETE FROM public.smp_waitlist_entries WHERE user_id = v_user_id;
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
