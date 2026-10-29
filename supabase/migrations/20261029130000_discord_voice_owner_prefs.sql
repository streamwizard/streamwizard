-- Remembered owner settings for join-to-create channels (SW-335).
--
-- When an owner renames, limits, bans, locks or hides their temp channel, the
-- bot saves it here, per hub. Their next channel from that hub's lobby starts
-- with it instead of the hub's defaults. /voice-reset forgets it. A hub can
-- turn this off with remember_owner_settings; then nothing is read or saved.
--
-- name and user_limit: NULL uses the hub's name template and default limit.
-- Deleting a hub deletes what its owners had saved.

ALTER TABLE "public"."discord_voice_hubs"
    ADD COLUMN "remember_owner_settings" boolean NOT NULL DEFAULT true;

CREATE TABLE "public"."discord_voice_owner_prefs" (
    "hub_id" uuid NOT NULL REFERENCES "public"."discord_voice_hubs" ("id") ON DELETE CASCADE,
    "guild_id" text NOT NULL,
    "discord_user_id" text NOT NULL,
    "name" text,
    "user_limit" integer,
    "locked" boolean NOT NULL DEFAULT false,
    "hidden" boolean NOT NULL DEFAULT false,
    "banned_user_ids" text[] NOT NULL DEFAULT '{}',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_voice_owner_prefs_pkey" PRIMARY KEY ("hub_id", "discord_user_id"),
    CONSTRAINT "discord_voice_owner_prefs_name_check" CHECK ("name" IS NULL OR char_length(btrim("name")) BETWEEN 1 AND 100),
    CONSTRAINT "discord_voice_owner_prefs_user_limit_check" CHECK ("user_limit" IS NULL OR "user_limit" BETWEEN 0 AND 99),
    CONSTRAINT "discord_voice_owner_prefs_banned_check" CHECK (cardinality("banned_user_ids") <= 100)
);

ALTER TABLE "public"."discord_voice_owner_prefs" OWNER TO "postgres";
ALTER TABLE "public"."discord_voice_owner_prefs" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."discord_voice_owner_prefs" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."discord_voice_owner_prefs" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_voice_owner_prefs" TO "authenticated";

CREATE POLICY "Admins read discord voice owner prefs" ON "public"."discord_voice_owner_prefs"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.is_strong_admin() ) );

CREATE OR REPLACE TRIGGER "discord_voice_owner_prefs_updated_at"
    BEFORE UPDATE ON "public"."discord_voice_owner_prefs"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
