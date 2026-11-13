import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@repo/supabase";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser, getGuildSettings } from "@repo/supabase/queries/discord/discord";
import { env } from "@/lib/env";
import { getGuildMemberRoleIds } from "@/server/discord/roles";
import { getDiscordStatus, type DiscordStatus } from "@/server/discord/status";

/**
 * The signed-in user's Discord status, read live: their linked account through
 * their own client, the Verified Member role id from the guild settings, and
 * their roles from Discord.
 *
 * Throws when the database or Discord does not answer. Callers decide what a
 * failed check means; it must not be read as "not linked".
 */
export function getDiscordStatusForUser(supabase: SupabaseClient<Database>, userId: string): Promise<DiscordStatus> {
  return getDiscordStatus(
    {
      getDiscordUserId: (id) => getDiscordUserIdForUser(supabase, id),
      // Guild settings are staff-only under RLS, hence the service role. The
      // query is keyed on our own guild id, never on anything from the caller.
      getVerifiedRoleId: async () =>
        (await getGuildSettings(supabaseAdmin, env.DISCORD_GUILD_ID))?.verified_role_id ?? null,
      getMemberRoleIds: getGuildMemberRoleIds,
    },
    userId,
  );
}
