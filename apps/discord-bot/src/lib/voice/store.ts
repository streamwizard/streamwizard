import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import {
  deleteVoiceChannels,
  insertVoiceChannel,
  listAllVoiceChannels,
  listVoiceHubs,
  updateVoiceChannel,
  type VoiceChannelRow,
  type VoiceHub,
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

export async function addTempChannel(row: Pick<VoiceChannelRow, "channel_id" | "guild_id" | "hub_id" | "owner_discord_user_id">): Promise<TempChannel> {
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

/** web-admin saved a hub: the next voice event reads them fresh. */
export function invalidateVoiceHubs(guildId: string): void {
  hubsCache.delete(guildId);
}
