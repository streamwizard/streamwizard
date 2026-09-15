-- Ticket history for the web-admin Discord dashboard (SW-333): transcripts
-- saved before a ticket channel is deleted, a per-ticket event timeline, and
-- display names captured when they happen so the dashboard doesn't need
-- Discord to render old tickets. Only the bot (service_role) writes; admins
-- can read.

ALTER TABLE "public"."discord_tickets"
    ADD COLUMN IF NOT EXISTS "opener_name" text,
    ADD COLUMN IF NOT EXISTS "claimed_by_name" text,
    ADD COLUMN IF NOT EXISTS "closed_by_name" text,
    ADD COLUMN IF NOT EXISTS "transcript_saved_at" timestamptz,
    ADD COLUMN IF NOT EXISTS "transcript_message_count" integer,
    ADD COLUMN IF NOT EXISTS "transcript_purged_at" timestamptz;

CREATE INDEX IF NOT EXISTS "discord_tickets_guild_created_idx"
    ON "public"."discord_tickets" ("guild_id", "created_at" DESC);

CREATE TABLE "public"."discord_ticket_messages" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" uuid NOT NULL REFERENCES "public"."discord_tickets"("id") ON DELETE CASCADE,
    "message_id" text NOT NULL,
    -- NULL once the author deleted their StreamWizard account (anonymised).
    "author_discord_id" text,
    "author_name" text NOT NULL,
    "author_avatar_url" text,
    "author_is_bot" boolean NOT NULL DEFAULT false,
    "content" text NOT NULL DEFAULT '',
    -- Raw Discord embed objects.
    "embeds" jsonb NOT NULL DEFAULT '[]'::jsonb,
    -- [{ id, name, size, content_type, r2_key, url }]: url is only set for
    -- small images copied to R2; everything else is metadata only.
    "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "created_at" timestamptz NOT NULL,
    "edited_at" timestamptz,
    CONSTRAINT "discord_ticket_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_messages_message_id_unique" UNIQUE ("message_id")
);

CREATE INDEX "discord_ticket_messages_ticket_created_idx"
    ON "public"."discord_ticket_messages" ("ticket_id", "created_at");
CREATE INDEX "discord_ticket_messages_author_idx"
    ON "public"."discord_ticket_messages" ("author_discord_id");

CREATE TABLE "public"."discord_ticket_events" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" uuid NOT NULL REFERENCES "public"."discord_tickets"("id") ON DELETE CASCADE,
    "type" text NOT NULL,
    "actor_discord_id" text,
    "actor_name" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_events_type_check" CHECK ("type" IN ('opened', 'claimed', 'closed'))
);

CREATE INDEX "discord_ticket_events_ticket_created_idx"
    ON "public"."discord_ticket_events" ("ticket_id", "created_at");

ALTER TABLE "public"."discord_ticket_messages" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_events" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discord_ticket_events" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read discord ticket messages" ON "public"."discord_ticket_messages"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );
CREATE POLICY "Admins read discord ticket events" ON "public"."discord_ticket_events"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."discord_ticket_messages" TO "service_role";
GRANT ALL ON TABLE "public"."discord_ticket_events" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_ticket_messages" TO "authenticated";
GRANT SELECT ON TABLE "public"."discord_ticket_events" TO "authenticated";

-- Retention (SW-351): transcripts and timelines of tickets closed more than
-- 12 months ago are purged daily. The ticket row itself (number, subject,
-- category, dates) stays. R2 copies of attachments expire through a bucket
-- lifecycle rule on the discord-tickets/ prefix.
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
  )
  UPDATE public.discord_tickets SET transcript_purged_at = now()
  WHERE id IN (SELECT id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_discord_ticket_transcripts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_discord_ticket_transcripts() TO service_role;

CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "extensions";

SELECT cron.schedule(
    'purge-old-discord-ticket-transcripts',
    '17 4 * * *',
    $$ SELECT public.purge_old_discord_ticket_transcripts(); $$
);
