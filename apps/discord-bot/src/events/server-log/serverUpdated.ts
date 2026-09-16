import { AuditLogEvent, Events, type Guild } from "discord.js";
import { emitAuditedEvent } from "../../lib/server-log/emit";
import type { BotEvent } from "../../types/discord";
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

export default {
  name: Events.GuildUpdate,
  async execute(oldGuild, newGuild) {
    const changes = diffFields(snapshot(oldGuild), snapshot(newGuild));
    if (!Object.keys(changes).length) return;
    await emitAuditedEvent(newGuild, "server.updated", { type: AuditLogEvent.GuildUpdate }, { changes });
  },
} satisfies BotEvent<typeof Events.GuildUpdate>;
