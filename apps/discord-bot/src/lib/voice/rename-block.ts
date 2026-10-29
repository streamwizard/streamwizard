import { escapeMarkdown, PermissionFlagsBits, time, TimestampStyles, type GuildMember } from "discord.js";
import { DEFAULT_VOICE_NAME_TEMPLATE } from "@repo/supabase/queries/discord-voice";
import { asTempVoiceChannel, refreshVoicePanel } from "./channel";
import { isVoiceStaff, serialized } from "./command";
import { renameTempChannel } from "./rename";
import { ensureLoaded, findOwnedChannel, getAllStaffRoleIds, getHubs, getTempChannel } from "./store";
import { renderChannelName } from "./template";

// Voice staff block a member from renaming temp channels, for a bad name. The
// block covers the whole server until it's lifted; while it holds, the
// member's channels use their lobby's name.

/** Voice staff anywhere in the server, or Manage Channels. Who may block and unblock. */
export async function isServerVoiceStaff(member: GuildMember): Promise<boolean> {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true;
  return isVoiceStaff(member, await getAllStaffRoleIds(member.guild.id));
}

/**
 * Renames the channel `target` owns right now back to its lobby's name (the
 * default template when the lobby is gone). Null when they own none. Otherwise
 * the sentence to add to the answer.
 */
export async function resetOwnedChannelName(target: GuildMember, reason: string): Promise<string | null> {
  await ensureLoaded();
  const owned = findOwnedChannel(target.guild.id, target.id);
  const channel = asTempVoiceChannel(owned ? target.guild.channels.cache.get(owned.channelId) : null);
  if (!channel) return null;

  return serialized(channel.id, async () => {
    const temp = getTempChannel(channel.id);
    if (!temp || temp.ownerId !== target.id) return null;
    const hub = temp.hubId ? (await getHubs(temp.guildId)).find((h) => h.id === temp.hubId) : null;
    const name = renderChannelName(hub?.name_template ?? DEFAULT_VOICE_NAME_TEMPLATE, {
      username: target.user.username,
      displayname: target.displayName,
    });
    await refreshVoicePanel(channel);
    if (channel.name === name) return null;

    const renamed = await renameTempChannel(channel, name, reason);
    if (renamed.ok) return `Their channel is called **${escapeMarkdown(name)}** again.`;
    const when = time(Math.ceil(renamed.retryAt / 1000), TimestampStyles.RelativeTime);
    return `Discord won't let me rename their channel until ${when} (2 renames per 10 minutes), so fix it with /voice-rename then.`;
  });
}
