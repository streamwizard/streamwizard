-- Voice staff roles for join-to-create channels (SW-335).
--
-- Members with a voice staff role can't be kicked or banned from temp
-- channels, always get in (locked, hidden or full), and /voice-claim takes a
-- channel over even while its owner is there. The list is set for the whole
-- server in discord_voice_settings; a hub can have its own instead.
--
-- discord_voice_hubs.staff_role_ids: NULL uses the server's list, an array
-- (empty too) is the hub's own.

CREATE TABLE "public"."discord_voice_settings" (
    "guild_id" text NOT NULL,
    "staff_role_ids" text[] NOT NULL DEFAULT '{}',
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_voice_settings_pkey" PRIMARY KEY ("guild_id"),
    CONSTRAINT "discord_voice_settings_staff_roles_check" CHECK (cardinality("staff_role_ids") <= 25)
);

ALTER TABLE "public"."discord_voice_hubs"
    ADD COLUMN "staff_role_ids" text[],
    ADD CONSTRAINT "discord_voice_hubs_staff_roles_check" CHECK ("staff_role_ids" IS NULL OR cardinality("staff_role_ids") <= 25);

ALTER TABLE "public"."discord_voice_settings" OWNER TO "postgres";
ALTER TABLE "public"."discord_voice_settings" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."discord_voice_settings" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."discord_voice_settings" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_voice_settings" TO "authenticated";

CREATE POLICY "Admins read discord voice settings" ON "public"."discord_voice_settings"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.is_strong_admin() ) );

CREATE OR REPLACE TRIGGER "discord_voice_settings_updated_at"
    BEFORE UPDATE ON "public"."discord_voice_settings"
    FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();
