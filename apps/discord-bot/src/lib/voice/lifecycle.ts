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
import {
  applyTempPermissions,
  asTempVoiceChannel,
  botExtraPermissions,
  deleteTempChannel,
  humanCount,
  postVoiceHelp,
  rawOverwrites,
  refreshVoicePanel,
} from "./channel";
import { serialized } from "./command";
import { forgetChannelInvites, forgetInvites, pendingInvites, usedInviteCodes } from "./invites";
import { buildTempOverwrites } from "./overwrites";
import { startingState } from "./prefs";
import { reconcileAction, type TempChannel } from "./rules";
import {
  addTempChannel,
  ensureLoaded,
  findOwnedChannel,
  forgetTempChannels,
  getHubs,
  getStaffRoleIds,
  getTempChannel,
  isRenameBlocked,
  listTempChannels,
  loadOwnerPrefs,
} from "./store";
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
    // A channel without its staff roles still beats no channel; the next
    // permission change (or settings save) puts them on.
    const staffRoleIds = await getStaffRoleIds(guild.id, hub.id).catch((error: unknown) => {
      reportError(error, "discord-bot voice: load staff roles", { guildId: guild.id, hubId: hub.id });
      return [];
    });
    // What the owner had last time in this hub, the hub's defaults otherwise.
    // A member blocked from renaming gets the lobby's name whatever they saved.
    const prefs = await loadOwnerPrefs(hub, member.id);
    const blocked = prefs?.name ? await isRenameBlocked(guild.id, member.id) : false;
    const start = startingState(hub, prefs && blocked ? { ...prefs, name: null } : prefs, {
      templateName: renderChannelName(hub.name_template, { username: member.user.username, displayname: member.displayName }),
      ownerId: member.id,
    });
    const channel = await guild.channels.create({
      name: start.name,
      type: ChannelType.GuildVoice,
      parent: parent?.id ?? null,
      userLimit: start.userLimit,
      bitrate: lobby.bitrate,
      permissionOverwrites: buildTempOverwrites({
        parent: parent ? rawOverwrites(parent) : [],
        everyoneId: guild.id,
        botId: guild.client.user.id,
        ownerId: member.id,
        locked: start.locked,
        hidden: start.hidden,
        bannedUserIds: start.bannedUserIds,
        guestIds: [],
        botExtraPermissions: botExtraPermissions(guild),
        staffRoleIds,
      }),
      reason: `Temporary voice channel for ${member.user.tag}`,
    });

    let temp: TempChannel;
    try {
      temp = await addTempChannel({
        channel_id: channel.id,
        guild_id: guild.id,
        hub_id: hub.id,
        owner_discord_user_id: member.id,
        locked: start.locked,
        hidden: start.hidden,
        banned_user_ids: start.bannedUserIds,
      });
    } catch (error) {
      await channel.delete("Couldn't save the temporary voice channel").catch(() => {});
      throw error;
    }

    if (await moveMember(member, lobby.id, channel.id, "Moved into their temporary channel")) {
      void postVoiceHelp(channel, temp);
    } else if (humanCount(channel) === 0) {
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

/**
 * A new member who joined through a /voice-invite link gets into that link's
 * channel past a lock or hide. The used link is the pending one missing from
 * its channel's invites. Two gone at once can't be told apart, so neither
 * joiner is let in; their owners can /voice-invite them by name.
 */
export async function admitInvitedMember(member: GuildMember): Promise<void> {
  const guild = member.guild;
  const candidates = pendingInvites(guild.id);
  if (candidates.length === 0 || member.user.bot) return;
  await ensureLoaded();

  const live = new Set<string>();
  for (const channelId of new Set(candidates.map((invite) => invite.channelId))) {
    const channel = asTempVoiceChannel(guild.channels.cache.get(channelId));
    if (!channel) {
      // Gone without a delete event: its links went with it, they weren't used.
      forgetChannelInvites(channelId);
      for (const invite of candidates) if (invite.channelId === channelId) live.add(invite.code);
      continue;
    }
    try {
      for (const code of (await channel.fetchInvites(false)).keys()) live.add(code);
    } catch (error) {
      // Can't tell which of this channel's links were used: treat them as unused.
      for (const invite of candidates) if (invite.channelId === channelId) live.add(invite.code);
      reportError(error, "discord-bot voice: fetch invites", { guildId: guild.id, channelId });
    }
  }

  const used = usedInviteCodes(candidates, live, Date.now());
  forgetInvites(used);
  if (used.length !== 1) {
    if (used.length > 1) console.warn(`[voice] ${used.length} invite links used at once in ${guild.id}; letting nobody in`);
    return;
  }

  const channelId = candidates.find((invite) => invite.code === used[0])!.channelId;
  const channel = asTempVoiceChannel(guild.channels.cache.get(channelId));
  if (!channel) return;
  await serialized(channelId, async () => {
    const temp = getTempChannel(channelId);
    if (!temp || !(temp.locked || temp.hidden) || temp.bannedUserIds.includes(member.id)) return;
    await applyTempPermissions(channel, temp, { add: [member.id], reason: `Joined through a /voice-invite link (${member.user.tag})` });
  });
}

/**
 * After a hub or the voice settings change: rewrites every open temp
 * channel's permissions in the server, so new or removed voice staff roles
 * apply now instead of on the channel's next lock or ban. One channel at a
 * time, each through its command queue.
 */
export async function refreshTempPermissions(guild: Guild): Promise<void> {
  await ensureLoaded();
  for (const { channelId } of listTempChannels(guild.id)) {
    const channel = asTempVoiceChannel(guild.channels.cache.get(channelId));
    if (!channel) continue;
    await serialized(channelId, async () => {
      const temp = getTempChannel(channelId);
      if (!temp) return;
      await applyTempPermissions(channel, temp, { reason: "Voice settings changed in the dashboard" });
      // The lobby may have started or stopped remembering settings.
      await refreshVoicePanel(channel);
    }).catch((error) => reportError(error, "discord-bot voice: refresh permissions", { guildId: guild.id, channelId }));
  }
}
