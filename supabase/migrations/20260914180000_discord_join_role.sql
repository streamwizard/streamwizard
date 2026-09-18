-- Role the bot gives every new (human) member on join, picked in the web-admin
-- Discord dashboard. NULL means no join role. Members still in Membership
-- Screening get it once they pass.
ALTER TABLE "public"."discord_guild_settings"
    ADD COLUMN IF NOT EXISTS "join_role_id" text;
