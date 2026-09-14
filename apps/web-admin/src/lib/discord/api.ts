import { cache } from "react";
import {
  DiscordApi,
  type DiscordChannel,
  type DiscordRole,
} from "@repo/discord-api";
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

// cache() dedupes within one request: a page and the action validating its
// submit each hit Discord once, not once per picker.
export const getGuildChannels = cache(async (): Promise<DiscordChannel[]> => {
  return requireDiscordContext().api.guilds.listChannels();
});

/** Every role, including @everyone and managed ones. */
const getAllGuildRoles = cache(async (): Promise<DiscordRole[]> => requireDiscordContext().api.guilds.listRoles());

export const getGuildRoles = cache(async (): Promise<DiscordRole[]> => {
  const { guildId } = requireDiscordContext();
  // @everyone shares the guild id; managed roles belong to integrations and
  // can't be handed out, so neither makes sense in a picker.
  return (await getAllGuildRoles()).filter((role) => role.id !== guildId && !role.managed);
});

export const getGuild = cache(async () => requireDiscordContext().api.guilds.getGuild());

/** Throws unless `id` is a channel in the guild of one of the allowed kinds. */
export async function assertChannel(id: string, kinds: ChannelKind[]): Promise<void> {
  const channel = (await getGuildChannels()).find((c) => c.id === id);
  const kind = channel ? channelKind(channel.type) : null;
  if (!kind || !kinds.includes(kind)) {
    throw new DashboardError(`That channel isn't a ${kinds.join(" or ")} channel in the server anymore`);
  }
}

/** Throws unless `id` is an assignable role in the guild. */
export async function assertRole(id: string): Promise<void> {
  if (!(await getGuildRoles()).some((role) => role.id === id)) {
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
