-- Rename blocks for join-to-create channels (SW-335).
--
-- Voice staff block a member from renaming temp channels, for a bad name.
-- The block covers the whole server, every lobby, until staff lift it with
-- /voice-rename-unblock or from web-admin. A blocked member's channels always
-- use the lobby's name template: the bot also deletes the name they had saved
-- in discord_voice_owner_prefs and renames the channel they own right now.
--
-- Usernames are kept as they were at block time, so web-admin can list blocks
-- without asking Discord for every member.

CREATE TABLE "public"."discord_voice_rename_blocks" (
    "guild_id" text NOT NULL,
    "discord_user_id" text NOT NULL,
    "username" text NOT NULL,
    "blocked_by_discord_user_id" text NOT NULL,
    "blocked_by_username" text NOT NULL,
    "reason" text,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "discord_voice_rename_blocks_pkey" PRIMARY KEY ("guild_id", "discord_user_id"),
    CONSTRAINT "discord_voice_rename_blocks_reason_check" CHECK ("reason" IS NULL OR char_length("reason") <= 200)
);

ALTER TABLE "public"."discord_voice_rename_blocks" OWNER TO "postgres";
ALTER TABLE "public"."discord_voice_rename_blocks" ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."discord_voice_rename_blocks" FROM "anon", "authenticated";
GRANT ALL ON TABLE "public"."discord_voice_rename_blocks" TO "service_role";
GRANT SELECT ON TABLE "public"."discord_voice_rename_blocks" TO "authenticated";

CREATE POLICY "Admins read discord voice rename blocks" ON "public"."discord_voice_rename_blocks"
    AS PERMISSIVE FOR SELECT TO authenticated
    USING ( ( SELECT public.is_strong_admin() ) );
