import { AuditLogEvent, Events, type Guild } from "discord.js";
import { findAuditEntry } from "../../lib/server-log/audit";
import { emitServerEvent, isServerEventEnabled } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { diffFields } from "../../lib/server-log/refs";

const channelName = (guild: Guild, id: string | null) => (id ? (guild.channels.cache.get(id)?.name ?? id) : null);

const snapshot = (guild: Guild) => ({
  name: guild.name,
  icon: guild.iconURL({ size: 256 }),
  banner: guild.bannerURL({ size: 512 }),
  description: guild.description,
  verification_level: guild.verificationLevel,
  explicit_content_filter: guild.explicitContentFilter,
  mfa_level: guild.mfaLevel,
  system_channel: channelName(guild, guild.systemChannelId),
  rules_channel: channelName(guild, guild.rulesChannelId),
  afk_channel: channelName(guild, guild.afkChannelId),
  vanity_url: guild.vanityURLCode,
});

export default serverLogEvent(Events.GuildUpdate, async (oldGuild, newGuild) => {
  const changes = diffFields(snapshot(oldGuild), snapshot(newGuild));
  if (!Object.keys(changes).length) return;
  if (!(await isServerEventEnabled(newGuild, "server.updated"))) return;
  const audit = await findAuditEntry(newGuild, AuditLogEvent.GuildUpdate);
  await emitServerEvent(
    newGuild,
    "server.updated",
    { changes, moderator: audit?.moderator ?? null, reason: audit?.reason ?? null },
    { actorDiscordId: audit?.moderator?.id },
  );
});
