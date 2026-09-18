import type { GuildMember } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getCommandRoles } from "@repo/supabase/queries/discord";
import { TtlCache } from "@repo/ttl-cache";

const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new TtlCache<string[]>({ ttlMs: CACHE_TTL_MS });

function cacheKey(guildId: string, commandName: string) {
  return `${guildId}:${commandName}`;
}

async function getAllowedRoleIds(guildId: string, commandName: string): Promise<string[]> {
  try {
    const roleIds = await cache.fetch(cacheKey(guildId, commandName), async () => {
      const rows = await getCommandRoles(supabase, guildId, commandName);
      return rows.map((row) => row.role_id);
    });
    return roleIds ?? [];
  } catch (error) {
    // Fails open for this one call only: a throwing loader is never cached, so
    // the next call retries instead of leaving the allowlist off for the TTL.
    reportError(error, "permissions.load-role-config", { guildId, commandName });
    return [];
  }
}

// Call after add/remove so the change takes effect immediately instead of
// waiting out the cache TTL.
export function invalidateCommandPermissionCache(guildId: string, commandName: string) {
  cache.delete(cacheKey(guildId, commandName));
}

// Drops every cached command for the guild — used when web-admin saves and
// can't say which command changed.
export function invalidateGuildPermissionCache(guildId: string) {
  cache.deleteWhere((key) => key.startsWith(`${guildId}:`));
}

// A command with no configured roles is open to everyone in the guild.
// Outside a guild (DMs) there's no role context to check against, so commands
// run unrestricted there. The server owner bypasses allowlists entirely, so
// restricting /permissions itself can never lock them out of undoing it.
export async function canRunCommand(member: GuildMember | null, commandName: string): Promise<boolean> {
  if (!member) return true;
  if (member.id === member.guild.ownerId) return true;

  const allowedRoleIds = await getAllowedRoleIds(member.guild.id, commandName);
  if (allowedRoleIds.length === 0) return true;

  return allowedRoleIds.some((roleId) => member.roles.cache.has(roleId));
}
