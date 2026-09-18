-- Who may open a ticket, who works it, and what can happen to it once open.
--
-- Categories carry their own staff: a category's staff roles see its tickets
-- on top of the server-wide staff role. Ping roles are mentioned when a ticket
-- opens; required roles gate who may open one. Limits and the cooldown are per
-- member per category, except max_open_per_user, which is server-wide.
--
-- Members added to a ticket get a row of their own, so the dashboard can show
-- who is in a ticket and the channel's permissions can be rebuilt from data
-- (move, claim and release all rewrite the overwrites).

ALTER TABLE "public"."discord_ticket_categories"
    ADD COLUMN IF NOT EXISTS "staff_role_ids" text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "ping_role_ids" text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS "required_role_ids" text[] NOT NULL DEFAULT '{}',
    -- Open tickets one member may have in this category. Null: no limit.
    ADD COLUMN IF NOT EXISTS "member_limit" integer,
    -- Open tickets in this category overall. A Discord category holds 50 channels.
    ADD COLUMN IF NOT EXISTS "total_limit" integer,
    -- Wait between two tickets by the same member in this category.
    ADD COLUMN IF NOT EXISTS "cooldown_seconds" integer NOT NULL DEFAULT 0,
    -- Discord slowmode on the ticket channel. 0 is off.
    ADD COLUMN IF NOT EXISTS "slowmode_seconds" integer NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "claiming_enabled" boolean NOT NULL DEFAULT true,
    -- [ticket.number], [member.name] and [ticket.category] are filled in.
    ADD COLUMN IF NOT EXISTS "channel_name_template" text NOT NULL DEFAULT 'ticket-[ticket.number]';

ALTER TABLE "public"."discord_ticket_categories"
    ADD CONSTRAINT "discord_ticket_categories_limits_check" CHECK (
        ("member_limit" IS NULL OR "member_limit" BETWEEN 1 AND 50)
        AND ("total_limit" IS NULL OR "total_limit" BETWEEN 1 AND 50)
        AND "cooldown_seconds" BETWEEN 0 AND 2592000
        AND "slowmode_seconds" BETWEEN 0 AND 21600
        AND char_length("channel_name_template") BETWEEN 1 AND 100
    );

ALTER TABLE "public"."discord_ticket_settings"
    -- Members holding any of these can't open tickets.
    ADD COLUMN IF NOT EXISTS "blocked_role_ids" text[] NOT NULL DEFAULT '{}',
    -- Open tickets one member may have across every category. Null: no limit.
    ADD COLUMN IF NOT EXISTS "max_open_per_user" integer,
    -- When a ticket is claimed, other staff roles lose sight of it.
    ADD COLUMN IF NOT EXISTS "claim_hides_from_other_staff" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "close_on_member_leave" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."discord_ticket_settings"
    ADD CONSTRAINT "discord_ticket_settings_max_open_check"
    CHECK ("max_open_per_user" IS NULL OR "max_open_per_user" BETWEEN 1 AND 50);

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "priority" text;

ALTER TABLE "public"."discord_tickets"
    ADD CONSTRAINT "discord_tickets_priority_check"
    CHECK ("priority" IS NULL OR "priority" IN ('low', 'medium', 'high'));

-- The gating checks count a member's open tickets on every Create Ticket press.
CREATE INDEX IF NOT EXISTS "discord_tickets_open_by_opener_idx"
    ON "public"."discord_tickets" ("guild_id", "opener_discord_user_id")
    WHERE "status" = 'open';

CREATE TABLE "public"."discord_ticket_members" (
    "ticket_id" uuid NOT NULL REFERENCES "public"."discord_tickets"("id") ON DELETE CASCADE,
    "discord_user_id" text NOT NULL,
    "name" text,
    "added_by_discord_user_id" text,
    "added_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_members_pkey" PRIMARY KEY ("ticket_id", "discord_user_id")
);

CREATE INDEX "discord_ticket_members_user_idx" ON "public"."discord_ticket_members" ("discord_user_id");

ALTER TABLE "public"."discord_ticket_members" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_members" ENABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE "public"."discord_ticket_members" TO "service_role";

CREATE POLICY "Admins read discord ticket members" ON "public"."discord_ticket_members"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );
GRANT SELECT ON TABLE "public"."discord_ticket_members" TO "authenticated";

-- Account deletion. Same body as 20260915120000_platform_events_tier1.sql plus
-- what tickets have grown since: a person is taken out of every ticket they
-- were added to, off the timeline entries that were about them, and the free
-- text of tickets they opened goes (close reason, feedback comes later).
-- Answers are blanked by the discord_tickets_anonymise_answers trigger.
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

ALTER FUNCTION public.delete_user_data(text, text) OWNER TO "postgres";
REVOKE ALL ON FUNCTION public.delete_user_data(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_data(text, text) TO service_role;
