-- Join-to-create voice channels (SW-335).
--
-- A hub is a lobby voice channel. Joining it makes the bot create a voice
-- channel for that member in the hub's category (the lobby's own category
-- when none is set), named from the hub's template, with the hub's default
-- user limit, and move them into it. The member owns that channel: /voice-*
-- commands lock, hide, rename, limit, kick, ban and hand it over. The bot
-- deletes it when the last person leaves.
--
-- discord_voice_channels holds the channels that exist right now. Rows are
-- short-lived: the bot deletes one with its channel, and on startup it deletes
-- empty leftovers and forgets channels that are gone. One channel per owner
-- per server, enforced by the unique key, so a member hopping in and out of
-- the lobby can never end up with two.
--
-- web-admin and the bot both write with the service role. Admins with a
-- strong session can read both tables, like the other Discord settings.

CREATE TABLE "public"."discord_voice_hubs" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "lobby_channel_id" text NOT NULL,
    -- NULL: create channels next to the lobby.
    "category_id" text,
    "name_template" text NOT NULL DEFAULT '{username}''s channel',
    -- 0 is no limit, Discord's own maximum is 99.
    "default_user_limit" integer NOT NULL DEFAULT 0,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_voice_hubs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_voice_hubs_guild_lobby_key" UNIQUE ("guild_id", "lobby_channel_id"),
    CONSTRAINT "discord_voice_hubs_name_template_check" CHECK (char_length(btrim("name_template")) BETWEEN 1 AND 100),
    CONSTRAINT "discord_voice_hubs_default_user_limit_check" CHECK ("default_user_limit" BETWEEN 0 AND 99)
);

CREATE TABLE "public"."discord_voice_channels" (
    "channel_id" text NOT NULL,
    "guild_id" text NOT NULL,
    -- Deleting a hub leaves its open channels working until they empty.
    "hub_id" uuid REFERENCES "public"."discord_voice_hubs" ("id") ON DELETE SET NULL,
    "owner_discord_user_id" text NOT NULL,
    "locked" boolean NOT NULL DEFAULT false,
    "hidden" boolean NOT NULL DEFAULT false,
    "banned_user_ids" text[] NOT NULL DEFAULT '{}',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_voice_channels_pkey" PRIMARY KEY ("channel_id"),
    CONSTRAINT "discord_voice_channels_guild_owner_key" UNIQUE ("guild_id", "owner_discord_user_id"),
    CONSTRAINT "discord_voice_channels_banned_check" CHECK (cardinality("banned_user_ids") <= 100)
);

CREATE INDEX "discord_voice_channels_hub_id_idx" ON "public"."discord_voice_channels" USING btree ("hub_id");

ALTER TABLE "public"."discord_voice_hubs" OWNER TO "postgres";
ALTER TABLE "public"."discord_voice_channels" OWNER TO "postgres";
ALTER TABLE "public"."discord_voice_hubs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."discord_voice_channels" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."discord_voice_hubs", "public"."discord_voice_channels" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."discord_voice_hubs", "public"."discord_voice_channels" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_voice_hubs", "public"."discord_voice_channels" TO "authenticated";

CREATE POLICY "Admins read discord voice hubs" ON "public"."discord_voice_hubs"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.is_strong_admin() ) );

CREATE POLICY "Admins read discord voice channels" ON "public"."discord_voice_channels"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.is_strong_admin() ) );

CREATE OR REPLACE TRIGGER "discord_voice_hubs_updated_at"
    BEFORE UPDATE ON "public"."discord_voice_hubs"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

CREATE OR REPLACE TRIGGER "discord_voice_channels_updated_at"
    BEFORE UPDATE ON "public"."discord_voice_channels"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- Voice hubs are a dashboard section too (create, update, delete).
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_section_check",
    ADD CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions', 'logs', 'messages', 'live', 'announcements', 'voice'));
