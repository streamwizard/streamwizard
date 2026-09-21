-- Announcements staff write in web-admin and the bot posts in the StreamWizard
-- Discord: a release, an event, a heads-up. One Discord message each: a line
-- with the ping, one embed, an optional link button. The JSON shape is
-- @repo/discord-message's Announcement.
--
-- web-admin autosaves draft and channel_id and moves status between draft and
-- scheduled. The bot owns posting -> posted/failed, posted, message_id,
-- posted_at and last_error: it writes them after a send, so the stored state
-- always matches what is in Discord. The scheduler claims a due row with a
-- conditional UPDATE (scheduled -> posting), so two ticks never post twice.
CREATE TABLE "public"."discord_announcements" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "draft" jsonb NOT NULL,
    "posted" jsonb,
    "channel_id" text,
    "status" text NOT NULL DEFAULT 'draft',
    "scheduled_for" timestamptz,
    "claimed_at" timestamptz,
    "message_id" text,
    "posted_at" timestamptz,
    "last_error" text,
    "created_by" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_announcements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_announcements_status_check"
        CHECK ("status" IN ('draft', 'scheduled', 'posting', 'posted', 'failed'))
);

CREATE INDEX "discord_announcements_guild_idx" ON "public"."discord_announcements" ("guild_id", "created_at");

-- The scheduler's tick: only rows waiting to go out.
CREATE INDEX "discord_announcements_due_idx"
    ON "public"."discord_announcements" ("scheduled_for")
    WHERE "status" = 'scheduled';

ALTER TABLE "public"."discord_announcements" OWNER TO "postgres";

CREATE OR REPLACE TRIGGER "discord_announcements_updated_at"
    BEFORE UPDATE ON "public"."discord_announcements"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();

-- web-admin's server actions and the bot both use the service-role client;
-- no anon/authenticated access.
ALTER TABLE "public"."discord_announcements" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_announcements" TO "service_role";

-- Announcements are a dashboard section too (create, update, publish, delete).
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_section_check",
    ADD CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions', 'logs', 'messages', 'live', 'announcements'));
