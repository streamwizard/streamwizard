-- Live role in the StreamWizard Discord. While a user with Discord linked is
-- live on Twitch, rest-api gives them the guild's live role and takes it
-- away when the stream ends. A hoisted role puts them at the top of the
-- member list. Runs on its own: the guild picks a role, and the role is on;
-- go-live posts (live_enabled) are a separate switch.

-- Per-user switch, separate from the go-live post. Default on: linking
-- Discord is the opt-in. Harmless for users who never linked.
ALTER TABLE "public"."user_preferences"
    ADD COLUMN IF NOT EXISTS "discord_live_role" boolean NOT NULL DEFAULT true;

-- Guild side: which role. Null means off.
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN IF NOT EXISTS "live_role_id" text;

-- What rest-api has handed out. The reconciliation sweep diffs this table
-- against broadcaster_live_status instead of paging Discord's member list,
-- so a missed stream.offline, a swapped role or an opt-out heals itself
-- without touching Discord for members that are already right.
-- Service-role only: rest-api writes, web-admin reads.
CREATE TABLE "public"."discord_live_roles" (
    "discord_user_id" text PRIMARY KEY,
    "broadcaster_id" text NOT NULL,
    "user_id" uuid REFERENCES "public"."users"("id") ON DELETE CASCADE,
    "role_id" text NOT NULL,
    "granted_at" timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE "public"."discord_live_roles" OWNER TO "postgres";

CREATE INDEX "discord_live_roles_broadcaster_idx"
    ON "public"."discord_live_roles" ("broadcaster_id");

ALTER TABLE "public"."discord_live_roles" ENABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE "public"."discord_live_roles" TO "service_role";
