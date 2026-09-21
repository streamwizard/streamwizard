-- Go-live notifications in the StreamWizard Discord (SW-336). When a user
-- with a linked Discord goes live on Twitch, rest-api posts an embed in the
-- guild's live channel and edits it when the stream ends. On by default for
-- everyone with Discord linked; each user can switch it off in the main app.
-- The guild picks the channel in web-admin.

-- Per-user switch. Default on: linking Discord is the opt-in, this is the
-- way out. Posting still requires a row in integrations_discord, so the
-- value is harmless for users who never linked.
ALTER TABLE "public"."user_preferences"
    ADD COLUMN IF NOT EXISTS "discord_live_notifications" boolean NOT NULL DEFAULT true;

-- Guild side: master switch and target channel. Posts never ping anyone;
-- the streamer is named with a silent mention.
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN IF NOT EXISTS "live_enabled" boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "live_channel_id" text;

-- One row per go-live message. The newest row per broadcaster drives both
-- the cooldown (a stream that drops and comes back within minutes edits the
-- existing message instead of posting again) and the stream.offline edit.
-- Title, game and names are stored so the "ended" edit needs no read from
-- Discord. Service-role only: rest-api writes, web-admin reads.
CREATE TABLE "public"."discord_live_posts" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "broadcaster_id" text NOT NULL,
    "user_id" uuid REFERENCES "public"."users"("id") ON DELETE CASCADE,
    "stream_id" text,
    "channel_id" text NOT NULL,
    "message_id" text NOT NULL,
    "title" text,
    "game_name" text,
    "user_login" text NOT NULL,
    "user_name" text NOT NULL,
    "started_at" timestamptz NOT NULL,
    "posted_at" timestamptz NOT NULL DEFAULT now(),
    "ended_at" timestamptz,
    "created_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."discord_live_posts" OWNER TO "postgres";

CREATE INDEX "discord_live_posts_broadcaster_posted_idx"
    ON "public"."discord_live_posts" ("broadcaster_id", "posted_at" DESC);

ALTER TABLE "public"."discord_live_posts" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_live_posts" TO "service_role";

-- Go-live is a dashboard section too.
ALTER TABLE "public"."discord_settings_audit"
    DROP CONSTRAINT "discord_settings_audit_section_check",
    ADD CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions', 'logs', 'messages', 'live'));
