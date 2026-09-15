import { AuditLogEvent, Events, type NonThreadGuildBasedChannel } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef, diffFields } from "../../lib/server-log/refs";

const snapshot = (channel: NonThreadGuildBasedChannel) => ({
  name: channel.name,
  category: channel.parent?.name ?? null,
  topic: "topic" in channel ? (channel.topic ?? null) : null,
  nsfw: "nsfw" in channel ? channel.nsfw : null,
  slowmode_seconds: "rateLimitPerUser" in channel ? (channel.rateLimitPerUser ?? 0) : null,
  bitrate: "bitrate" in channel ? channel.bitrate : null,
  user_limit: "userLimit" in channel ? channel.userLimit : null,
});

const overwrites = (channel: NonThreadGuildBasedChannel) =>
  JSON.stringify(
    [...channel.permissionOverwrites.cache.values()]
      .map((o) => [o.id, o.allow.bitfield.toString(), o.deny.bitfield.toString()])
      .sort(),
  );

// Position changes (reordering the sidebar) touch many channels; not logged.
export default serverLogEvent(Events.ChannelUpdate, async (oldChannel, newChannel) => {
  if (oldChannel.isDMBased() || newChannel.isDMBased()) return;
  const changes = diffFields(snapshot(oldChannel), snapshot(newChannel));
  const overwritesChanged = overwrites(oldChannel) !== overwrites(newChannel);
  if (!Object.keys(changes).length && !overwritesChanged) return;
  if (!(await isServerEventEnabled(newChannel.guild, "channel.updated"))) return;

  const audit = await findAuditEntry(
    newChannel.guild,
    overwritesChanged && !Object.keys(changes).length
      ? AuditLogEvent.ChannelOverwriteUpdate
      : AuditLogEvent.ChannelUpdate,
    { targetId: newChannel.id },
  );
  if (audit?.bySelf) return;
  await emitServerEvent(
    newChannel.guild,
    "channel.updated",
    {
      channel: channelRef(newChannel)!,
      changes,
      overwrites_changed: overwritesChanged,
      moderator: audit?.moderator ?? null,
      reason: audit?.reason ?? null,
    },
    { actorDiscordId: audit?.moderator?.id },
  );
});
