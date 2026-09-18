import { Events } from "discord.js";
import { markSelfAction } from "../lib/server-log/self-actions";
import {
  buildWelcomeMessage,
  getConnectionInfo,
  getGuildWelcomeSettings,
  getJoinNumber,
  grantJoinRole,
  resolveWelcomeChannel,
} from "../lib/welcome";
import type { BotEvent } from "../types/discord";
import { reportError } from "@repo/sentry";
import { captureServerEvent } from "@repo/posthog/server";

export default {
  name: Events.GuildMemberAdd,
  async execute(member) {
    console.log(`[guildMemberAdd] Member "${member.user.tag}" joined guild "${member.guild.name}"`);

    // Connection info is fetched before the welcome-settings early returns so
    // every join gets counted, welcome message or not.
    const connection = await getConnectionInfo(member);
    try {
      captureServerEvent(connection.userId ?? `discord:${member.id}`, "discord_guild_joined", {
        linked: connection.isConnected,
      });
    } catch (error) {
      reportError(error, "discord-bot member add: posthog", { memberId: member.id });
    }

    const settings = await getGuildWelcomeSettings(member.guild);
    // The join role doesn't depend on welcome messages being on.
    await grantJoinRole(member, settings?.join_role_id);

    if (settings?.welcome_enabled === false) {
      console.warn(
        `[guildMemberAdd] Guild "${member.guild.name}" has welcome messages disabled, skipping welcome message`,
      );
      return;
    }

    console.log(`[guildMemberAdd] Guild "${member.guild.name}" has welcome messages enabled, sending welcome message`);
    const channel = await resolveWelcomeChannel(member.guild, settings?.welcome_channel_id);
    if (!channel) {
      console.warn(
        `[guildMemberAdd] Guild "${member.guild.name}" has no usable welcome channel configured, skipping welcome message`,
      );
      return;
    }

    console.log(`[guildMemberAdd] Sending welcome message to channel "${channel.name}"`);
    try {
      const joinNumber = await getJoinNumber(member);

      // A linked account may have failed its initial role grant if the user
      // OAuth'd before joining the server (Discord rejects role grants for
      // non-members). Joining is the first point we're guaranteed they're an
      // actual member, so retry here — otherwise the welcome message below
      // claims "your roles are good to go" while no role was ever granted.
      if (connection.isConnected && settings?.verified_role_id) {
        try {
          markSelfAction("roles", member.id);
          await member.roles.add(settings.verified_role_id);
        } catch (roleError) {
          reportError(roleError, "discord-bot member add: verified role", {
            memberId: member.id,
            guildId: member.guild.id,
          });
        }
      }

      await channel.send(buildWelcomeMessage(member, joinNumber, connection));
    } catch (error) {
      reportError(error, "discord-bot member add: welcome", { memberId: member.id, guildId: member.guild.id });
    }
  },
} satisfies BotEvent<typeof Events.GuildMemberAdd>;
