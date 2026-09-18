-- The stale-ticket sweeper: a ticket nobody has written in for a while gets a
-- reminder, and (when the server turns it on) closes on its own if the
-- reminder goes unanswered.
--
-- Both timers are hours and both are off when null. Auto-close counts from
-- the reminder, not from the last message: a ticket is never closed without
-- having been warned first. The bot's sweeper runs every few minutes and claims
-- each step with a conditional UPDATE (stale_warned_at IS NULL, status =
-- 'open'), so a restart between two runs can't warn or close a ticket twice.
--
-- A person's message after the reminder clears stale_warned_at (see
-- archive_ticket_message below), which starts the stale timer over.

ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "stale_after_hours" integer,
    ADD COLUMN IF NOT EXISTS "auto_close_after_hours" integer;

ALTER TABLE "public"."discord_ticket_settings"
    ADD CONSTRAINT "discord_ticket_settings_stale_hours_check" CHECK (
        ("stale_after_hours" IS NULL OR "stale_after_hours" BETWEEN 1 AND 8760)
        AND ("auto_close_after_hours" IS NULL OR "auto_close_after_hours" BETWEEN 1 AND 8760)
    );

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "stale_warned_at" timestamptz;

-- Same body as 20260918140000_discord_ticket_live_archive.sql, plus: a
-- person's message takes the ticket off the stale list.
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
            END,
            -- A reply after the reminder: the ticket is live again.
            stale_warned_at = CASE
                WHEN stale_warned_at IS NOT NULL AND v_created_at >= stale_warned_at THEN NULL
                ELSE stale_warned_at
            END
        WHERE id = p_ticket_id;
    END IF;
END;
$$;
