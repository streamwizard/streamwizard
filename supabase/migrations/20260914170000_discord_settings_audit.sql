-- Audit trail for Discord bot settings changed from the web-admin dashboard
-- (SW-345). One row per save or action, holding only the fields that changed.
-- Slash-command changes aren't recorded here (yet). Writes go through
-- web-admin server actions (service_role, after an explicit admin check).
CREATE TABLE "public"."discord_settings_audit" (
    "id" uuid NOT NULL DEFAULT gen_random_uuid(),
    "guild_id" text NOT NULL,
    "section" text NOT NULL,
    "action" text NOT NULL DEFAULT 'update',
    "old_value" jsonb,
    "new_value" jsonb,
    "changed_by" uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    "changed_by_discord_id" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_settings_audit_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "discord_settings_audit_section_check"
        CHECK ("section" IN ('welcome', 'activity', 'tickets', 'permissions')),
    CONSTRAINT "discord_settings_audit_action_check"
        CHECK ("action" IN ('update', 'repost_panel', 'test_welcome'))
);

ALTER TABLE "public"."discord_settings_audit" OWNER TO "postgres";

CREATE INDEX "discord_settings_audit_guild_created_idx"
    ON "public"."discord_settings_audit" ("guild_id", "created_at" DESC);

ALTER TABLE "public"."discord_settings_audit" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read discord settings audit" ON "public"."discord_settings_audit"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.check_user_role('admin') ) );

GRANT ALL ON TABLE "public"."discord_settings_audit" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_settings_audit" TO "authenticated";
