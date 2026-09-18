-- Ticket categories and products move out of the code and into tables the
-- web-admin dashboard edits.
--
-- Until now the category list lived in three places (this enum, the bot's
-- modal, web-admin's labels) and the product list in a TypeScript constant.
-- Tickets keep storing the slug, so nothing about existing rows changes; the
-- slug now points at a row that carries the label, emoji and description.
--
-- Slugs are immutable once created and unique per guild. A category or product
-- that tickets still point at can't be deleted (ON DELETE RESTRICT): it is
-- archived instead, which hides it from the open-a-ticket flow while old
-- tickets keep their label.
--
-- The 4 categories and 8 products the code shipped with are backfilled here,
-- for every guild that has ticket settings or tickets, because the foreign
-- keys need them to exist. This is safe to run before the new code deploys:
-- the old bot inserts the same slugs as plain strings.

-- Tables ----------------------------------------------------------------------

CREATE TABLE "public"."discord_ticket_categories" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "slug" text NOT NULL,
    "name" text NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "emoji" text,
    "position" integer NOT NULL DEFAULT 0,
    "enabled" boolean NOT NULL DEFAULT true,
    "archived_at" timestamptz,
    -- The Discord category channel new tickets are created under. Null falls
    -- back to discord_ticket_settings.category_id.
    "discord_category_id" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_categories_guild_slug_key" UNIQUE ("guild_id", "slug"),
    CONSTRAINT "discord_ticket_categories_slug_check" CHECK ("slug" ~ '^[a-z0-9_]{1,32}$'),
    CONSTRAINT "discord_ticket_categories_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 45),
    CONSTRAINT "discord_ticket_categories_description_check" CHECK (char_length("description") <= 100),
    CONSTRAINT "discord_ticket_categories_emoji_check" CHECK ("emoji" IS NULL OR char_length("emoji") BETWEEN 1 AND 64)
);

CREATE TABLE "public"."discord_ticket_products" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "slug" text NOT NULL,
    "label" text NOT NULL,
    "description" text NOT NULL DEFAULT '',
    "emoji" text,
    "position" integer NOT NULL DEFAULT 0,
    "archived_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_ticket_products_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_ticket_products_guild_slug_key" UNIQUE ("guild_id", "slug"),
    CONSTRAINT "discord_ticket_products_slug_check" CHECK ("slug" ~ '^[a-z0-9_]{1,32}$'),
    CONSTRAINT "discord_ticket_products_label_check" CHECK (char_length(btrim("label")) BETWEEN 1 AND 45),
    CONSTRAINT "discord_ticket_products_description_check" CHECK (char_length("description") <= 100),
    CONSTRAINT "discord_ticket_products_emoji_check" CHECK ("emoji" IS NULL OR char_length("emoji") BETWEEN 1 AND 64)
);

CREATE INDEX "discord_ticket_categories_guild_idx" ON "public"."discord_ticket_categories" ("guild_id", "position");
CREATE INDEX "discord_ticket_products_guild_idx" ON "public"."discord_ticket_products" ("guild_id", "position");

ALTER TABLE "public"."discord_ticket_categories" OWNER TO "postgres";
ALTER TABLE "public"."discord_ticket_products" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_ticket_categories_updated_at"
    BEFORE UPDATE ON "public"."discord_ticket_categories"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "discord_ticket_products_updated_at"
    BEFORE UPDATE ON "public"."discord_ticket_products"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- web-admin's server actions and the bot both use the service-role client;
-- no anon/authenticated access.
ALTER TABLE "public"."discord_ticket_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discord_ticket_products" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_ticket_categories" TO "service_role";
GRANT ALL ON TABLE "public"."discord_ticket_products" TO "service_role";

-- Enum to text ----------------------------------------------------------------

ALTER TABLE "public"."discord_tickets" ALTER COLUMN "category" TYPE text USING "category"::text;
DROP TYPE "public"."discord_ticket_category";

-- Backfill --------------------------------------------------------------------

WITH guilds AS (
    SELECT "guild_id" FROM "public"."discord_ticket_settings"
    UNION
    SELECT "guild_id" FROM "public"."discord_tickets"
),
defaults ("slug", "name", "description", "emoji", "position") AS (
    VALUES
        ('bug', 'Bug', 'Something is broken or not working', '🐛', 0),
        ('feature', 'Feature', 'Request a new feature or improvement', '✨', 1),
        ('support', 'Support', 'Get help with using StreamWizard', '💬', 2),
        ('other', 'Other', 'Anything else', '📨', 3)
)
INSERT INTO "public"."discord_ticket_categories" ("guild_id", "slug", "name", "description", "emoji", "position")
SELECT guilds."guild_id", defaults."slug", defaults."name", defaults."description", defaults."emoji", defaults."position"
FROM guilds CROSS JOIN defaults
ON CONFLICT ("guild_id", "slug") DO NOTHING;

WITH guilds AS (
    SELECT "guild_id" FROM "public"."discord_ticket_settings"
    UNION
    SELECT "guild_id" FROM "public"."discord_tickets"
),
defaults ("slug", "label", "description", "emoji", "position") AS (
    VALUES
        ('cloud_obs', 'Cloud OBS', 'Your OBS in the cloud and the deck', '☁️', 0),
        ('overlays', 'Overlays & widgets', 'Overlay editor, widgets and alerts', '🎨', 1),
        ('clips', 'Clip management', 'Clip folders, syncing and search', '🎬', 2),
        ('vods', 'VODs', 'Past broadcasts and markers', '📼', 3),
        ('analytics', 'Analytics', 'Stream stats and viewer numbers', '📊', 4),
        ('discord_bot', 'Discord bot', 'This bot and its commands', '🤖', 5),
        ('account', 'Account & billing', 'Login, linking and subscriptions', '👤', 6),
        ('other', 'Something else', 'Not sure, or none of the above', '❔', 7)
)
INSERT INTO "public"."discord_ticket_products" ("guild_id", "slug", "label", "description", "emoji", "position")
SELECT guilds."guild_id", defaults."slug", defaults."label", defaults."description", defaults."emoji", defaults."position"
FROM guilds CROSS JOIN defaults
ON CONFLICT ("guild_id", "slug") DO NOTHING;

-- A ticket pointing at a slug outside the shipped lists (there shouldn't be
-- any) gets a row of its own rather than failing the foreign key.
INSERT INTO "public"."discord_ticket_products" ("guild_id", "slug", "label", "position", "archived_at")
SELECT DISTINCT t."guild_id", t."product", t."product", 100, now()
FROM "public"."discord_tickets" t
WHERE t."product" IS NOT NULL AND t."product" ~ '^[a-z0-9_]{1,32}$'
ON CONFLICT ("guild_id", "slug") DO NOTHING;

UPDATE "public"."discord_tickets" SET "product" = NULL
WHERE "product" IS NOT NULL AND "product" !~ '^[a-z0-9_]{1,32}$';

-- Foreign keys ----------------------------------------------------------------

ALTER TABLE "public"."discord_tickets"
    ADD CONSTRAINT "discord_tickets_category_fkey"
        FOREIGN KEY ("guild_id", "category")
        REFERENCES "public"."discord_ticket_categories" ("guild_id", "slug")
        ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT "discord_tickets_product_fkey"
        FOREIGN KEY ("guild_id", "product")
        REFERENCES "public"."discord_ticket_products" ("guild_id", "slug")
        ON UPDATE CASCADE ON DELETE RESTRICT;

-- Settings --------------------------------------------------------------------

-- Set once the form fields and message copy defaults were written for a guild,
-- so removing every category on purpose doesn't bring the defaults back.
ALTER TABLE "public"."discord_ticket_settings"
    ADD COLUMN IF NOT EXISTS "defaults_seeded_at" timestamptz;

-- A guild that sets tickets up after this migration has no rows yet: the first
-- settings write seeds them. Mark the guilds backfilled above as seeded.
UPDATE "public"."discord_ticket_settings" SET "defaults_seeded_at" = now();

-- Categories, products and (soon) tags are created from the dashboard.
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_action_check",
    ADD CONSTRAINT "discord_settings_audit_action_check"
        CHECK ("action" IN ('update', 'repost_panel', 'test_welcome', 'test_log', 'publish', 'delete', 'create'));
