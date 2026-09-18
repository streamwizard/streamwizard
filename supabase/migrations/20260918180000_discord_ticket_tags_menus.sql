-- Tags, context menus and DM-to-open.
--
-- A tag is a canned answer: staff post it with /tag <name>, and a tag with
-- trigger keywords posts itself once per ticket when a member's message
-- contains one (plain substring match, never a regex from user input). One
-- row per guild and name.
--
-- A ticket opened from a message's context menu remembers that message's
-- link; one opened by staff on someone's behalf remembers who opened it. Both
-- are Discord ids or URLs on their own columns, so account deletion can
-- blank them.
--
-- dm_open_enabled lets a member start a ticket by DMing the bot. Off by
-- default: it needs the bot to read DMs at all.

CREATE TABLE "public"."discord_ticket_tags" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "name" text NOT NULL,
    "content" text NOT NULL,
    "trigger_keywords" text[] NOT NULL DEFAULT '{}',
    "auto_reply" boolean NOT NULL DEFAULT false,
    "position" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_tags_guild_name_key" UNIQUE ("guild_id", "name"),
    CONSTRAINT "discord_ticket_tags_name_check" CHECK (char_length("name") BETWEEN 1 AND 32 AND "name" ~ '^[a-z0-9_-]+$'),
    CONSTRAINT "discord_ticket_tags_content_check" CHECK (char_length("content") BETWEEN 1 AND 2000),
    CONSTRAINT "discord_ticket_tags_keywords_check" CHECK (cardinality("trigger_keywords") <= 20)
);

ALTER TABLE "public"."discord_ticket_tags" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_tags" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_ticket_tags" TO "service_role";

CREATE POLICY "Admins read discord ticket tags" ON "public"."discord_ticket_tags"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );
GRANT SELECT ON TABLE "public"."discord_ticket_tags" TO "authenticated";

CREATE OR REPLACE TRIGGER "discord_ticket_tags_updated_at"
    BEFORE UPDATE ON "public"."discord_ticket_tags"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "references_message_url" text,
    ADD COLUMN IF NOT EXISTS "created_by_discord_user_id" text;

ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "dm_open_enabled" boolean NOT NULL DEFAULT false;

-- Account deletion: the staff member who opened tickets for others.
-- Same body as 20260918170000_discord_ticket_feedback_stats.sql plus created_by_discord_user_id.
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

  SELECT discord_user_id INTO v_discord_user_id
  FROM public.integrations_discord
  WHERE user_id = v_user_id;

  PERFORM public.emit_platform_event(
    'user.deleted', v_user_id, NULL,
    public.platform_event_identity(v_user_id) || jsonb_build_object(
      'reason', CASE WHEN p_reason IN ('requested', 'twitch_revoked') THEN p_reason ELSE 'requested' END
    )
  );

  IF v_discord_user_id IS NOT NULL THEN
    UPDATE public.platform_events
    SET payload = public.strip_platform_event_text(payload, ARRAY['content', 'before', 'after'])
    WHERE event_type LIKE 'message.%'
      AND payload->>'discord_user_id' = v_discord_user_id
      AND NOT (payload ? 'text_purged');
  END IF;

  UPDATE public.platform_events
  SET payload = public.strip_platform_event_text(payload, ARRAY['description', 'subject', 'contact', 'comment'])
  WHERE subject_user_id = v_user_id
    AND payload ?| ARRAY['description', 'subject', 'contact', 'comment'];

  PERFORM set_config('streamwizard.suppress_discord_unlink_event', 'on', true);

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
  DELETE FROM public.clips WHERE user_id = v_user_id;
  DELETE FROM public.vods WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.clip_folders WHERE user_id = v_user_id;
  DELETE FROM public.testimonials WHERE user_id = v_user_id;
  DELETE FROM public.feedback WHERE user_id = v_user_id;
  DELETE FROM public.system_events WHERE broadcaster_id = p_twitch_user_id;
  DELETE FROM public.irl_geo_track WHERE user_id = v_user_id;
  DELETE FROM public.user_state_definitions WHERE user_id = v_user_id;
  DELETE FROM public.user_states WHERE user_id = v_user_id;
  PERFORM set_config('streamwizard.suppress_role_event', 'on', true);
  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.user_preferences WHERE user_id = v_user_id;
  DELETE FROM public.integrations_twitch WHERE user_id = v_user_id;
  DELETE FROM public.integrations WHERE user_id = v_user_id;
  DELETE FROM public.users WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;
