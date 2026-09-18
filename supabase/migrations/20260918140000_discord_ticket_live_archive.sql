-- Ticket conversations are archived as they happen, not scraped from the
-- channel at close.
--
-- Before: the bot read the whole channel when a ticket closed. A message
-- deleted before then was never seen, an edit only kept its last state, and a
-- channel deleted by hand took the conversation with it. Now every message in
-- an open ticket channel is written when it is sent; an edit updates the text
-- and stamps edited_at; a delete stamps deleted_at and keeps the text, so
-- staff can still read what a ticket was about. The close still reconciles
-- against the channel once, to pick up anything sent while the bot was down.
--
-- archive_ticket_message does the message write and the ticket's activity
-- stamps in one round trip and returns nothing, because this runs once per
-- message. The activity stamps feed response-time stats and the stale sweep:
--   last_message_at / last_message_by_staff   newest human message
--   first_response_at                          first staff message, set once
-- Bot messages (the intro, "X claimed this ticket", stale warnings) never
-- touch them: only p_counts = true does.

ALTER TABLE "public"."discord_ticket_messages"
    ADD COLUMN IF NOT EXISTS "deleted_at" timestamptz,
    ADD COLUMN IF NOT EXISTS "pinned" boolean NOT NULL DEFAULT false;

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "first_response_at" timestamptz,
    ADD COLUMN IF NOT EXISTS "last_message_at" timestamptz,
    ADD COLUMN IF NOT EXISTS "last_message_by_staff" boolean;

-- The stale sweep asks for open tickets by how long they have been quiet.
CREATE INDEX IF NOT EXISTS "discord_tickets_open_activity_idx"
    ON "public"."discord_tickets" ("guild_id", "last_message_at")
    WHERE "status" = 'open';

CREATE OR REPLACE FUNCTION "public"."archive_ticket_message"(
    "p_ticket_id" uuid,
    "p_message" jsonb,
    "p_counts" boolean,
    "p_by_staff" boolean
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE
    v_created_at timestamptz := (p_message->>'created_at')::timestamptz;
BEGIN
    INSERT INTO public.discord_ticket_messages (
        ticket_id, message_id, author_discord_id, author_name, author_avatar_url, author_is_bot,
        content, embeds, attachments, created_at, edited_at
    ) VALUES (
        p_ticket_id,
        p_message->>'message_id',
        p_message->>'author_discord_id',
        COALESCE(p_message->>'author_name', 'Unknown'),
        p_message->>'author_avatar_url',
        COALESCE((p_message->>'author_is_bot')::boolean, false),
        COALESCE(p_message->>'content', ''),
        COALESCE(p_message->'embeds', '[]'::jsonb),
        COALESCE(p_message->'attachments', '[]'::jsonb),
        v_created_at,
        (p_message->>'edited_at')::timestamptz
    )
    -- Seen twice (a reconcile racing the gateway event): the first write stands,
    -- it may already carry an R2 copy the second one doesn't.
    ON CONFLICT (message_id) DO NOTHING;

    IF p_counts THEN
        UPDATE public.discord_tickets
        SET last_message_at = GREATEST(COALESCE(last_message_at, v_created_at), v_created_at),
            last_message_by_staff = CASE
                WHEN last_message_at IS NULL OR v_created_at >= last_message_at THEN p_by_staff
                ELSE last_message_by_staff
            END,
            first_response_at = CASE
                WHEN p_by_staff THEN LEAST(COALESCE(first_response_at, v_created_at), v_created_at)
                ELSE first_response_at
            END
        WHERE id = p_ticket_id;
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION "public"."archive_ticket_message"(uuid, jsonb, boolean, boolean) FROM PUBLIC, "anon", "authenticated";
GRANT EXECUTE ON FUNCTION "public"."archive_ticket_message"(uuid, jsonb, boolean, boolean) TO "service_role";

-- What the opener gets when their ticket closes: a DM with a summary and the
-- conversation as a file. `messages` holds the dashboard-editable copy (the
-- DM's text today, stale warnings and the like later); missing keys fall back
-- to the defaults in code.
ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "dm_on_close" boolean NOT NULL DEFAULT true,
    ADD COLUMN IF NOT EXISTS "messages" jsonb NOT NULL DEFAULT '{}'::jsonb;
