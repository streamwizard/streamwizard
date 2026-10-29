import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import {
  blockVoiceRename,
  deleteVoiceChannels,
  deleteVoiceOwnerPrefs,
  getVoiceOwnerPrefs,
  getVoiceSettings,
  insertVoiceChannel,
  listAllVoiceChannels,
  listVoiceHubs,
  listVoiceRenameBlocks,
  staffRolesFor,
  unblockVoiceRename,
  updateVoiceChannel,
  upsertVoiceOwnerPrefs,
  type VoiceChannelRow,
  type VoiceHub,
  type VoiceOwnerPrefs,
  type VoiceOwnerPrefsPatch,
  type VoiceRenameBlock,
  type VoiceSettings,
} from "@repo/supabase/queries/discord-voice";
import { TtlCache } from "@repo/ttl-cache";
import type { TempChannel } from "./rules";

// The database is the record; this is the bot's copy of it. Every voice state
// change asks "is this a temp channel?" and "is this a lobby?", so neither may
// cost a query. The bot runs as a single instance and is the only writer of
// temp channels, so the copy stays right as long as every write goes through
// here: database first, then the map.

const HUBS_TTL_MS = 60_000;
const hubsCache = new TtlCache<VoiceHub[]>({ ttlMs: HUBS_TTL_MS });
const settingsCache = new TtlCache<VoiceSettings>({ ttlMs: HUBS_TTL_MS });
/** Member ids blocked from renaming, per server. */
const renameBlocksCache = new TtlCache<Set<string>>({ ttlMs: HUBS_TTL_MS });

const channels = new Map<string, TempChannel>();
let loading: Promise<void> | null = null;

function toTemp(row: VoiceChannelRow): TempChannel {
  return {
    channelId: row.channel_id,
    guildId: row.guild_id,
    hubId: row.hub_id,
    ownerId: row.owner_discord_user_id,
    locked: row.locked,
    hidden: row.hidden,
    bannedUserIds: row.banned_user_ids,
    createdAt: Date.parse(row.created_at),
  };
}

/**
 * Loads every stored temp channel once. A failed load isn't remembered, so the
 * next voice event or command tries again instead of treating every temp
 * channel as an ordinary one until a restart.
 */
export function ensureLoaded(): Promise<void> {
  loading ??= listAllVoiceChannels(supabase).then(
    (rows) => {
      channels.clear();
      for (const row of rows) channels.set(row.channel_id, toTemp(row));
    },
    (error: unknown) => {
      loading = null;
      throw error;
    },
  );
  return loading;
}

export function getTempChannel(channelId: string | null | undefined): TempChannel | null {
  return (channelId && channels.get(channelId)) || null;
}

export function listTempChannels(guildId?: string): TempChannel[] {
  return [...channels.values()].filter((c) => !guildId || c.guildId === guildId);
}

/** The temp channel `userId` owns in the server, if any. */
export function findOwnedChannel(guildId: string, userId: string): TempChannel | null {
  for (const c of channels.values()) if (c.guildId === guildId && c.ownerId === userId) return c;
  return null;
}

export async function addTempChannel(
  row: Pick<VoiceChannelRow, "channel_id" | "guild_id" | "hub_id" | "owner_discord_user_id"> &
    Partial<Pick<VoiceChannelRow, "locked" | "hidden" | "banned_user_ids">>,
): Promise<TempChannel> {
  const temp = toTemp(await insertVoiceChannel(supabase, row));
  channels.set(temp.channelId, temp);
  return temp;
}

export type TempChannelPatch = Partial<Pick<TempChannel, "ownerId" | "locked" | "hidden" | "bannedUserIds">>;

export async function updateTempChannel(channelId: string, patch: TempChannelPatch): Promise<TempChannel | null> {
  const row = await updateVoiceChannel(supabase, channelId, {
    ...(patch.ownerId !== undefined && { owner_discord_user_id: patch.ownerId }),
    ...(patch.locked !== undefined && { locked: patch.locked }),
    ...(patch.hidden !== undefined && { hidden: patch.hidden }),
    ...(patch.bannedUserIds !== undefined && { banned_user_ids: patch.bannedUserIds }),
  });
  if (!row) {
    channels.delete(channelId);
    return null;
  }
  const temp = toTemp(row);
  channels.set(channelId, temp);
  return temp;
}

export async function forgetTempChannels(channelIds: string[]): Promise<void> {
  if (channelIds.length === 0) return;
  await deleteVoiceChannels(supabase, channelIds);
  for (const id of channelIds) channels.delete(id);
}

/**
 * The server's hubs, cached for a minute. Never throws: a failed read is
 * reported and means no lobby works for this one event. Failures aren't
 * cached, so the next join tries again.
 */
export async function getHubs(guildId: string): Promise<VoiceHub[]> {
  try {
    return (await hubsCache.fetch(guildId, () => listVoiceHubs(supabase, guildId))) ?? [];
  } catch (error) {
    reportError(error, "discord-bot voice: load hubs", { guildId });
    return [];
  }
}

/**
 * Voice staff roles for a temp channel from `hubId`: the hub's own list, or
 * the server's. Cached with the hubs. Throws when the settings can't be read,
 * so a channel is never rewritten without its staff roles.
 */
export async function getStaffRoleIds(guildId: string, hubId: string | null): Promise<string[]> {
  const hub = hubId ? (await getHubs(guildId)).find((h) => h.id === hubId) : null;
  if (hub?.staff_role_ids) return hub.staff_role_ids;
  return staffRolesFor(hub, await settingsCache.fetch(guildId, () => getVoiceSettings(supabase, guildId)));
}

/**
 * Every voice staff role in the server: the server's list and every lobby's
 * own. For staff commands that aren't about one channel.
 */
export async function getAllStaffRoleIds(guildId: string): Promise<string[]> {
  const settings = await settingsCache.fetch(guildId, () => getVoiceSettings(supabase, guildId));
  const ids = new Set(settings?.staff_role_ids ?? []);
  for (const hub of await getHubs(guildId)) for (const id of hub.staff_role_ids ?? []) ids.add(id);
  return [...ids];
}

/** web-admin saved a hub or the voice settings, or lifted a rename block: the next voice event reads them fresh. */
export function invalidateVoiceHubs(guildId: string): void {
  hubsCache.delete(guildId);
  settingsCache.delete(guildId);
  renameBlocksCache.delete(guildId);
}

/**
 * Whether voice staff blocked `userId` from renaming. Cached with the hubs.
 * A failed read is reported and lets the rename through: a missed block is
 * fixed by staff, a broken /voice-rename for everyone isn't.
 */
export async function isRenameBlocked(guildId: string, userId: string): Promise<boolean> {
  try {
    const blocked = await renameBlocksCache.fetch(guildId, async () =>
      new Set((await listVoiceRenameBlocks(supabase, guildId)).map((b) => b.discord_user_id)),
    );
    return blocked?.has(userId) ?? false;
  } catch (error) {
    reportError(error, "discord-bot voice: load rename blocks", { guildId });
    return false;
  }
}

/** Stores the block and deletes the member's saved names. */
export async function addRenameBlock(block: Omit<VoiceRenameBlock, "created_at">): Promise<void> {
  await blockVoiceRename(supabase, block);
  renameBlocksCache.delete(block.guild_id);
}

/** False when they weren't blocked. */
export async function removeRenameBlock(guildId: string, userId: string): Promise<boolean> {
  const lifted = await unblockVoiceRename(supabase, guildId, userId);
  renameBlocksCache.delete(guildId);
  return lifted !== null;
}

/**
 * What `userId` saved for `hub`'s channels. Null when the hub doesn't
 * remember settings or nothing is saved. Never throws: a failed read is
 * reported and the channel starts with the hub's defaults.
 */
export async function loadOwnerPrefs(hub: VoiceHub, userId: string): Promise<VoiceOwnerPrefs | null> {
  if (!hub.remember_owner_settings) return null;
  try {
    return await getVoiceOwnerPrefs(supabase, hub.id, userId);
  } catch (error) {
    reportError(error, "discord-bot voice: load owner settings", { guildId: hub.guild_id, hubId: hub.id });
    return null;
  }
}

/**
 * Saves a change the owner just made, for their next channel from the same
 * hub. Skipped when voice staff made it on the owner's behalf, the hub is
 * gone, or it doesn't remember settings. Never throws: the change itself went
 * through, only remembering it failed.
 */
export async function rememberOwnerPrefs(temp: TempChannel, actorId: string, patch: VoiceOwnerPrefsPatch): Promise<void> {
  const hubId = temp.hubId;
  if (!hubId || actorId !== temp.ownerId) return;
  const hub = (await getHubs(temp.guildId)).find((h) => h.id === hubId);
  if (!hub?.remember_owner_settings) return;
  try {
    await upsertVoiceOwnerPrefs(supabase, { hub_id: hubId, guild_id: temp.guildId, discord_user_id: temp.ownerId }, patch);
  } catch (error) {
    reportError(error, "discord-bot voice: save owner settings", { guildId: temp.guildId, hubId });
  }
}

/** /voice-reset. False when nothing was saved. */
export function forgetOwnerPrefs(hubId: string, userId: string): Promise<boolean> {
  return deleteVoiceOwnerPrefs(supabase, hubId, userId);
}
