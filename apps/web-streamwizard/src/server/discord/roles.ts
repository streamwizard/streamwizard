import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { DiscordApi, DiscordMemberNotFoundError } from "@repo/discord-api";
import { reportError } from "@repo/sentry";
import type { Database } from "@repo/supabase";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getGuildSettings } from "@repo/supabase/queries/discord/discord";
import { getDiscordIntegrationByUserId } from "@repo/supabase/queries/users/user";
import { env } from "@/lib/env";

// Grants/revokes a role directly via the bot, instead of going through
// Discord's Linked Roles (role_connections.write) flow. That flow requires
// a second, hand-rolled OAuth leg (Discord rejects the scope under PKCE)
// and Discord only auto-grants the role when verification is triggered from
// its own native "Linked Roles" UI per-guild — not from an external OAuth
// flow. Assigning the role directly with the bot avoids all of that and
// only needs the user's Discord ID, which we already have from the
// "identify" link. Which role to grant is configured per-guild via the
// bot's /setup wizard (see discord_guild_settings.verified_role_id).

export { DiscordMemberNotFoundError };

const discordApi = new DiscordApi({ botToken: env.DISCORD_BOT_TOKEN, guildId: env.DISCORD_GUILD_ID });

export function assignRole(discordUserId: string, roleId: string) {
  return discordApi.members.assignRole(discordUserId, roleId);
}

export function removeRole(discordUserId: string, roleId: string) {
  return discordApi.members.removeRole(discordUserId, roleId);
}

export function getGuildMemberRoleIds(discordUserId: string) {
  return discordApi.members.getRoleIds(discordUserId);
}

/**
 * Best-effort: takes the Verified Member role off the user's linked Discord
 * account, before the link or the account goes away. Never throws: a failure
 * here must not block the unlink or the deletion, so it is reported instead.
 */
export async function revokeVerifiedRole(client: SupabaseClient<Database>, userId: string): Promise<void> {
  try {
    const { data: integration } = await getDiscordIntegrationByUserId(client, userId);
    const settings = await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID);
    if (!settings?.verified_role_id) {
      console.log(`[discord-roles] No verified_role_id configured for guild ${env.DISCORD_GUILD_ID}, skipping role removal.`);
      return;
    }
    if (integration?.discord_user_id) await removeRole(integration.discord_user_id, settings.verified_role_id);
  } catch (error) {
    reportError(error, "discord-roles.revoke-verified", { userId });
  }
}
