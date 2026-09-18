-- The ticket form, the ticket panel and a category's opening message become
-- things the dashboard edits instead of literals in the bot.
--
-- Form fields. Each category has its own form, up to 5 fields because that is
-- all a Discord modal holds (the app enforces it; a trigger would only turn a
-- friendly error into an ugly one). `kind` says where the answer goes:
--   subject, description, product  -> the ticket's own columns
--   text, select                   -> discord_ticket_answers
-- A category without a subject field files tickets under its own name.
--
-- Answers keep a snapshot of the question's label. The form can change, or a
-- field can be deleted (field_id goes null), and an old ticket still reads the
-- way it was asked.
--
-- Panel and opening message hold @repo/discord-message's BuiltMessage JSON,
-- the same shape the message builder writes. Null means "the default", which
-- lives in @repo/discord-message so bot and dashboard agree on it.

CREATE TABLE "public"."discord_ticket_form_fields" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "category_id" uuid NOT NULL REFERENCES "public"."discord_ticket_categories"("id") ON DELETE CASCADE,
    "kind" text NOT NULL,
    "label" text NOT NULL,
    "placeholder" text NOT NULL DEFAULT '',
    "style" text NOT NULL DEFAULT 'short',
    "required" boolean NOT NULL DEFAULT true,
    "min_length" integer,
    "max_length" integer,
    -- select only: [{ "label": "...", "value": "...", "description": "...", "emoji": "..." }]
    "options" jsonb NOT NULL DEFAULT '[]'::jsonb,
    "position" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_form_fields_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_form_fields_kind_check" CHECK ("kind" IN ('subject', 'description', 'product', 'text', 'select')),
    CONSTRAINT "discord_ticket_form_fields_style_check" CHECK ("style" IN ('short', 'paragraph')),
    CONSTRAINT "discord_ticket_form_fields_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 45),
    CONSTRAINT "discord_ticket_form_fields_placeholder_check" CHECK (char_length("placeholder") <= 100),
    CONSTRAINT "discord_ticket_form_fields_length_check" CHECK (
        ("min_length" IS NULL OR "min_length" BETWEEN 0 AND 4000)
        AND ("max_length" IS NULL OR "max_length" BETWEEN 1 AND 4000)
        AND ("min_length" IS NULL OR "max_length" IS NULL OR "min_length" <= "max_length")
    )
);

-- subject, description and product map onto one ticket column each, so a form
-- can ask each of them once.
CREATE UNIQUE INDEX "discord_ticket_form_fields_single_kind_key"
    ON "public"."discord_ticket_form_fields" ("category_id", "kind")
    WHERE "kind" IN ('subject', 'description', 'product');

CREATE INDEX "discord_ticket_form_fields_category_idx"
    ON "public"."discord_ticket_form_fields" ("category_id", "position");

CREATE TABLE "public"."discord_ticket_answers" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" uuid NOT NULL REFERENCES "public"."discord_tickets"("id") ON DELETE CASCADE,
    "field_id" uuid REFERENCES "public"."discord_ticket_form_fields"("id") ON DELETE SET NULL,
    "label" text NOT NULL,
    "value" text NOT NULL DEFAULT '',
    "position" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_answers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "discord_ticket_answers_ticket_idx" ON "public"."discord_ticket_answers" ("ticket_id", "position");

ALTER TABLE "public"."discord_ticket_form_fields" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_answers" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_ticket_form_fields_updated_at"
    BEFORE UPDATE ON "public"."discord_ticket_form_fields"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

ALTER TABLE "public"."discord_ticket_form_fields" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discord_ticket_answers" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_ticket_form_fields" TO "service_role";
GRANT ALL ON TABLE "public"."discord_ticket_answers" TO "service_role";

-- Answers are part of a ticket's history, read by the dashboard like the
-- transcript is.
CREATE POLICY "Admins read discord ticket answers" ON "public"."discord_ticket_answers"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );
GRANT SELECT ON TABLE "public"."discord_ticket_answers" TO "authenticated";

-- Every existing category gets the form the bot used to hard-code.
INSERT INTO "public"."discord_ticket_form_fields"
    ("category_id", "kind", "label", "placeholder", "style", "required", "max_length", "position")
SELECT c."id", f."kind", f."label", f."placeholder", f."style", true, f."max_length", f."position"
FROM "public"."discord_ticket_categories" c
CROSS JOIN (
    VALUES
        ('subject', 'Subject', 'A short summary of your issue', 'short', 100, 0),
        ('description', 'Description', 'Tell us what''s going on, with as much detail as you can', 'paragraph', 2000, 1),
        ('product', 'Product', 'What is this about?', 'short', NULL::integer, 2)
) AS f ("kind", "label", "placeholder", "style", "max_length", "position");

ALTER TABLE "public"."discord_ticket_categories"
    ADD COLUMN IF NOT EXISTS "opening_message" jsonb;

-- A designed panel can be several Discord messages (a banner is one of its
-- own). panel_message_id stays, holding the message with the buttons, so a bot
-- from before this migration still finds and removes its panel.
ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "panel" jsonb,
    ADD COLUMN IF NOT EXISTS "panel_message_ids" text[] NOT NULL DEFAULT '{}';

UPDATE "public"."discord_ticket_settings"
SET "panel_message_ids" = ARRAY["panel_message_id"]
WHERE "panel_message_id" IS NOT NULL AND "panel_message_ids" = '{}';

-- Account deletion: the opener's own words go, the question labels stay.
-- delete_user_data() anonymises a ticket by setting its opener to 'deleted'.
-- Blanking the answers at that moment keeps that function from having to know
-- every table that hangs off a ticket.
CREATE OR REPLACE FUNCTION "public"."anonymise_ticket_answers"() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    IF NEW."opener_discord_user_id" = 'deleted' AND OLD."opener_discord_user_id" IS DISTINCT FROM 'deleted' THEN
        UPDATE "public"."discord_ticket_answers" SET "value" = '' WHERE "ticket_id" = NEW."id";
    END IF;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION "public"."anonymise_ticket_answers"() FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE TRIGGER "discord_tickets_anonymise_answers"
    AFTER UPDATE OF "opener_discord_user_id" ON "public"."discord_tickets"
    FOR EACH ROW EXECUTE FUNCTION "public"."anonymise_ticket_answers"();

-- Retention: answers are the opener's words, so they go with the transcript
-- after 12 months. Close reasons are staff-written free text about the same
-- conversation and go too.
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
  UPDATE public.discord_tickets SET transcript_purged_at = now(), close_reason = NULL
  WHERE id IN (SELECT id FROM expired);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_old_discord_ticket_transcripts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_old_discord_ticket_transcripts() TO service_role;
