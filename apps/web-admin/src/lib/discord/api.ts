import { cache } from "react";
import { DiscordApi, type DiscordChannel, type DiscordGuild, type DiscordRole } from "@repo/discord-api";
import { TtlCache } from "@repo/ttl-cache";
import { env } from "@/lib/env";
import { DashboardError } from "./errors";
import { channelKind, type ChannelKind } from "./channel-kind";

// Server-only: holds the bot token. Import this from server components and
// server actions only — never from a "use client" file.

export interface DiscordContext {
  api: DiscordApi;
  guildId: string;
}

/** `null` when the dashboard env isn't set, so pages can show a setup card. */
export function getDiscordContext(): DiscordContext | null {
  if (!env.DISCORD_BOT_TOKEN || !env.DISCORD_GUILD_ID) return null;
  return {
    api: new DiscordApi({ botToken: env.DISCORD_BOT_TOKEN, guildId: env.DISCORD_GUILD_ID }),
    guildId: env.DISCORD_GUILD_ID,
  };
}

/** Like getDiscordContext, but for server actions where "not configured" is an error. */
export function requireDiscordContext(): DiscordContext {
  const ctx = getDiscordContext();
  if (!ctx) throw new Error("Discord isn't configured for web-admin");
  return ctx;
}

// Two cache layers. The TtlCaches live for the process: channels and roles
// change rarely, and the ticket page used to fetch both on every poll and
// websocket ping until Discord rate limited it. React's cache() on top dedupes
// within one request, so a page and the action validating its submit share
// one lookup. A failed load rejects and is not stored, so the next request
// retries. Pickers can be up to GUILD_TTL_MS stale; assertChannel/assertRole
// refetch once on a miss so a channel made a moment ago still validates.
const GUILD_TTL_MS = 2 * 60_000;
const PROFILE_TTL_MS = 10 * 60_000;
const channelsCache = new TtlCache<DiscordChannel[]>({ ttlMs: GUILD_TTL_MS });
const rolesCache = new TtlCache<DiscordRole[]>({ ttlMs: GUILD_TTL_MS });
const guildCache = new TtlCache<DiscordGuild>({ ttlMs: PROFILE_TTL_MS });
const botProfileCache = new TtlCache<{ name: string; avatarUrl: string | null }>({ ttlMs: PROFILE_TTL_MS });

async function loadChannels(): Promise<DiscordChannel[]> {
  const { api, guildId } = requireDiscordContext();
  return (await channelsCache.fetch(guildId, () => api.guilds.listChannels())) ?? [];
}

async function loadAllRoles(): Promise<DiscordRole[]> {
  const { api, guildId } = requireDiscordContext();
  return (await rolesCache.fetch(guildId, () => api.guilds.listRoles())) ?? [];
}

export const getGuildChannels = cache(loadChannels);

/** Every role, including @everyone and managed ones. */
const getAllGuildRoles = cache(loadAllRoles);

/** Skips the cache: for validating an id that isn't in the cached list. */
async function refreshGuildChannels(): Promise<DiscordChannel[]> {
  channelsCache.delete(requireDiscordContext().guildId);
  return loadChannels();
}

async function refreshGuildRoles(): Promise<DiscordRole[]> {
  rolesCache.delete(requireDiscordContext().guildId);
  return loadAllRoles();
}

/** After the dashboard creates a role itself, so the next page load lists it. */
export function invalidateGuildRoles(): void {
  rolesCache.delete(requireDiscordContext().guildId);
}

export const getGuildRoles = cache(async (): Promise<DiscordRole[]> => {
  const { guildId } = requireDiscordContext();
  // @everyone shares the guild id; managed roles belong to integrations and
  // can't be handed out, so neither makes sense in a picker.
  return (await getAllGuildRoles()).filter((role) => role.id !== guildId && !role.managed);
});

export const getGuild = cache(async (): Promise<DiscordGuild> => {
  const { api, guildId } = requireDiscordContext();
  const guild = await guildCache.fetch(guildId, () => api.guilds.getGuild());
  if (!guild) throw new DashboardError("The bot isn't in the server");
  return guild;
});

/** Name and avatar for the message builder's preview. Falls back to a plain name: a preview isn't worth failing a page over. */
export const getBotProfile = cache(async (): Promise<{ name: string; avatarUrl: string | null }> => {
  const fallback = { name: "StreamWizard", avatarUrl: null };
  const clientId = env.DISCORD_CLIENT_ID;
  if (!clientId) return fallback;
  const profile = await botProfileCache
    .fetch(clientId, async () => {
      const user = await requireDiscordContext().api.guilds.getUser(clientId);
      if (!user) return null;
      return {
        name: user.global_name ?? user.username,
        avatarUrl: user.avatar ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=80` : null,
      };
    })
    .catch(() => null);
  return profile ?? fallback;
});

/** Throws unless `id` is a channel in the guild of one of the allowed kinds. */
export async function assertChannel(id: string, kinds: ChannelKind[]): Promise<void> {
  const channel =
    (await getGuildChannels()).find((c) => c.id === id) ?? (await refreshGuildChannels()).find((c) => c.id === id);
  const kind = channel ? channelKind(channel.type) : null;
  if (!kind || !kinds.includes(kind)) {
    throw new DashboardError(`That channel isn't a ${kinds.join(" or ")} channel in the server anymore`);
  }
}

/** Throws unless `id` is an assignable role in the guild. */
export async function assertRole(id: string): Promise<void> {
  const known =
    (await getGuildRoles()).some((role) => role.id === id) ||
    (await refreshGuildRoles()).some((role) => role.id === id);
  if (!known) {
    throw new DashboardError("That role doesn't exist in the server anymore");
  }
}

const ADMINISTRATOR = 1n << 3n;
const MANAGE_ROLES = 1n << 28n;

/**
 * Throws unless the bot can hand out `id`: it needs Manage Roles and a role
 * higher than the target. Skipped when DISCORD_CLIENT_ID isn't set, since the
 * bot's own member record can't be looked up without it.
 */
export async function assertRoleAssignable(id: string): Promise<void> {
  await assertRole(id);
  if (!env.DISCORD_CLIENT_ID) return;

  const { api, guildId } = requireDiscordContext();
  const [roles, botRoleIds] = await Promise.all([getAllGuildRoles(), api.members.getRoleIds(env.DISCORD_CLIENT_ID)]);
  if (!botRoleIds) throw new DashboardError("The bot isn't in the server");

  const botRoles = roles.filter((role) => role.id === guildId || botRoleIds.includes(role.id));
  const permissions = botRoles.reduce((bits, role) => bits | BigInt(role.permissions), 0n);
  if (!(permissions & (ADMINISTRATOR | MANAGE_ROLES))) {
    throw new DashboardError("The bot needs the Manage Roles permission to give out roles.");
  }

  const target = roles.find((role) => role.id === id);
  const botTop = Math.max(...botRoles.map((role) => role.position));
  if (target && target.position >= botTop) {
    throw new DashboardError(
      `The bot can't give out @${target.name}. In Server Settings, Roles, drag the bot's role above it.`,
    );
  }
}
