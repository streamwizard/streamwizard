-- Messages designed in web-admin's Discord message builder. A guild has as
-- many as it likes (welcome, rules, links, anything), each with a name for the
-- dashboard and a channel of its own. The JSON shape is @repo/discord-message's
-- BuiltMessage.
--
-- web-admin autosaves draft, draft_channel_id and draft_create_channel. The
-- bot owns published, channel_id, message_ids and published_at: it writes them
-- after a publish, so the stored location always matches what is in Discord.
CREATE TABLE "public"."discord_built_messages" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "name" text NOT NULL,
    "draft" jsonb NOT NULL,
    "draft_channel_id" text,
    "draft_create_channel" boolean NOT NULL DEFAULT false,
    "published" jsonb,
    "channel_id" text,
    "message_ids" text[] NOT NULL DEFAULT '{}',
    "published_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_built_messages_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_built_messages_name_check" CHECK (char_length(btrim("name")) BETWEEN 1 AND 60)
);

CREATE INDEX "discord_built_messages_guild_idx" ON "public"."discord_built_messages" ("guild_id", "created_at");

ALTER TABLE "public"."discord_built_messages" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_built_messages_updated_at"
    BEFORE UPDATE ON "public"."discord_built_messages"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- web-admin's server actions and the bot both use the service-role client;
-- no anon/authenticated access.
ALTER TABLE "public"."discord_built_messages" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_built_messages" TO "service_role";

-- Messages are a dashboard section too, with "publish" and "delete" actions.
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_section_check",
    ADD CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions', 'logs', 'messages')),
    DROP CONSTRAINT "discord_settings_audit_action_check",
    ADD CONSTRAINT "discord_settings_audit_action_check"
        CHECK ("action" IN ('update', 'repost_panel', 'test_welcome', 'test_log', 'publish', 'delete'));
