import {
  ChannelType,
  DiscordAPIError,
  RESTJSONErrorCodes,
  type CategoryChannel,
  type Client,
  type Guild,
  type GuildMember,
  type VoiceBasedChannel,
  type VoiceState,
} from "discord.js";
import type { VoiceHub } from "@repo/supabase/queries/discord-voice";
import { reportError } from "@repo/sentry";
import { asTempVoiceChannel, deleteTempChannel, humanCount, rawOverwrites } from "./channel";
import { buildTempOverwrites } from "./overwrites";
import { reconcileAction } from "./rules";
import { addTempChannel, ensureLoaded, findOwnedChannel, forgetTempChannels, getHubs, getTempChannel, listTempChannels } from "./store";
import { renderChannelName } from "./template";

// Join-to-create: a member joins a hub's lobby, gets a channel of their own,
// and the channel goes away when the last person leaves it. Runs next to the
// activity tracker on every voice state change; the two never touch each
// other's state, and the move into the new channel is just another voice
// change the tracker sees.

/** `${guildId}:${userId}` of members the bot is making a channel for right now. */
const creating = new Set<string>();

export async function handleTempVoiceState(oldState: VoiceState, newState: VoiceState): Promise<void> {
  if (oldState.channelId === newState.channelId) return;
  const guild = newState.guild;

  try {
    await ensureLoaded();
  } catch (error) {
    reportError(error, "discord-bot voice: load temp channels");
    return;
  }

  // Leave first: someone hopping from their own channel to the lobby frees
  // the old one before a new one is made.
  if (oldState.channelId && getTempChannel(oldState.channelId)) {
    await deleteIfEmpty(guild, oldState.channelId).catch((error) =>
      reportError(error, "discord-bot voice: delete empty channel", { channelId: oldState.channelId }),
    );
  }

  const member = newState.member;
  if (!newState.channel || !member || member.user.bot) return;
  const hub = (await getHubs(guild.id)).find((h) => h.lobby_channel_id === newState.channelId);
  if (!hub) return;
  await createForMember(member, hub, newState.channel).catch((error) =>
    reportError(error, "discord-bot voice: create channel", { guildId: guild.id, hubId: hub.id }),
  );
}

async function deleteIfEmpty(guild: Guild, channelId: string): Promise<void> {
  const channel = guild.channels.cache.get(channelId);
  if (channel?.isVoiceBased() && humanCount(channel) > 0) return;
  await deleteTempChannel(guild, channelId, "Temporary voice channel is empty");
}

/** The hub's category when it still exists, otherwise the lobby's own. */
function resolveParent(guild: Guild, hub: VoiceHub, lobby: VoiceBasedChannel): CategoryChannel | null {
  const configured = hub.category_id ? guild.channels.cache.get(hub.category_id) : undefined;
  if (configured?.type === ChannelType.GuildCategory) return configured;
  return lobby.parent;
}

/**
 * Makes `member` a channel from `hub` and moves them into it. One at a time
 * per member: rejoining the lobby while the first channel is being made does
 * nothing, and a member who already owns a channel is sent back to it instead
 * of getting a second one (the database's unique owner key backs this up).
 */
export async function createForMember(member: GuildMember, hub: VoiceHub, lobby: VoiceBasedChannel): Promise<void> {
  const guild = member.guild;
  const key = `${guild.id}:${member.id}`;
  if (creating.has(key)) return;
  creating.add(key);

  try {
    const owned = findOwnedChannel(guild.id, member.id);
    if (owned) {
      const existing = asTempVoiceChannel(guild.channels.cache.get(owned.channelId));
      if (existing) {
        await moveMember(member, lobby.id, existing.id, "Back to their own temporary channel");
        return;
      }
      await forgetTempChannels([owned.channelId]);
    }

    const parent = resolveParent(guild, hub, lobby);
    const channel = await guild.channels.create({
      name: renderChannelName(hub.name_template, { username: member.user.username, displayname: member.displayName }),
      type: ChannelType.GuildVoice,
      parent: parent?.id ?? null,
      userLimit: hub.default_user_limit,
      bitrate: lobby.bitrate,
      permissionOverwrites: buildTempOverwrites({
        parent: parent ? rawOverwrites(parent) : [],
        everyoneId: guild.id,
        botId: guild.client.user.id,
        ownerId: member.id,
        locked: false,
        hidden: false,
        bannedUserIds: [],
        guestIds: [],
      }),
      reason: `Temporary voice channel for ${member.user.tag}`,
    });

    try {
      await addTempChannel({ channel_id: channel.id, guild_id: guild.id, hub_id: hub.id, owner_discord_user_id: member.id });
    } catch (error) {
      await channel.delete("Couldn't save the temporary voice channel").catch(() => {});
      throw error;
    }

    if (!(await moveMember(member, lobby.id, channel.id, "Moved into their temporary channel")) && humanCount(channel) === 0) {
      await deleteTempChannel(guild, channel.id, "Its owner left before it was ready");
    }
  } finally {
    creating.delete(key);
  }
}

/** Moves the member when they're still in the lobby. False when they had already gone. */
async function moveMember(member: GuildMember, lobbyId: string, channelId: string, reason: string): Promise<boolean> {
  if (member.voice.channelId !== lobbyId) return false;
  try {
    await member.voice.setChannel(channelId, reason);
    return true;
  } catch (error) {
    // Left voice between the check and the move.
    if (error instanceof DiscordAPIError && error.code === RESTJSONErrorCodes.TargetUserIsNotConnectedToVoice) return false;
    throw error;
  }
}

/**
 * Deletes the server's empty temp channels and forgets the ones Discord no
 * longer has. Shared by the startup reconcile and /voice-clean.
 */
export async function cleanTempChannels(guild: Guild): Promise<{ deleted: number; forgotten: number }> {
  await ensureLoaded();
  const now = Date.now();
  const gone: string[] = [];
  let deleted = 0;

  for (const temp of listTempChannels(guild.id)) {
    const channel = guild.channels.cache.get(temp.channelId);
    const voice = channel?.isVoiceBased() ? channel : null;
    const action = reconcileAction({ exists: !!voice, humans: voice ? humanCount(voice) : 0, ageMs: now - temp.createdAt });
    if (action === "forget") gone.push(temp.channelId);
    if (action === "delete") {
      await deleteTempChannel(guild, temp.channelId, "Temporary voice channel is empty");
      deleted++;
    }
  }

  await forgetTempChannels(gone);
  return { deleted, forgotten: gone.length };
}

/**
 * After a restart: clean every server, then give a channel to anyone who
 * joined a lobby while the bot was away (no voice event will come for them).
 */
export async function reconcileTempChannels(client: Client<true>): Promise<void> {
  await ensureLoaded();
  for (const guild of client.guilds.cache.values()) {
    try {
      await cleanTempChannels(guild);
      for (const hub of await getHubs(guild.id)) {
        const lobby = guild.channels.cache.get(hub.lobby_channel_id);
        if (!lobby?.isVoiceBased()) continue;
        for (const member of lobby.members.values()) {
          if (member.user.bot) continue;
          await createForMember(member, hub, lobby).catch((error) =>
            reportError(error, "discord-bot voice: create channel on startup", { guildId: guild.id, hubId: hub.id }),
          );
        }
      }
    } catch (error) {
      reportError(error, "discord-bot voice: reconcile", { guildId: guild.id });
    }
  }
}
