import { ChannelType, MessageFlags, PermissionFlagsBits, SlashCommandBuilder } from "discord.js";
import { supabase } from "@repo/supabase";
import { getGuildSettings, setWelcomeChannel, setWelcomeEnabled } from "@repo/supabase/queries/discord";
import type { Command } from "../types/discord";

export default {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("Configure StreamWizard for this server")
    // Hides the command from members without Manage Server in their client;
    // Discord also enforces this server-side for users without an override.
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("welcome-channel")
        .setDescription("Set the channel where new member welcome messages are posted")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Text channel for welcome messages")
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName("welcome-toggle")
        .setDescription("Enable or disable the welcome message")
        .addBooleanOption((opt) => opt.setName("enabled").setDescription("Whether to post a welcome message").setRequired(true))
    )
    .addSubcommand((sub) => sub.setName("view").setDescription("Show the current setup for this server")),
  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "welcome-channel") {
      const channel = interaction.options.getChannel("channel", true);
      await setWelcomeChannel(supabase, interaction.guildId, channel.id);
      await interaction.reply({ content: `✅ Welcome messages will be posted in <#${channel.id}>.`, flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === "welcome-toggle") {
      const enabled = interaction.options.getBoolean("enabled", true);
      await setWelcomeEnabled(supabase, interaction.guildId, enabled);
      await interaction.reply({
        content: enabled ? "✅ Welcome messages are now enabled." : "✅ Welcome messages are now disabled.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // view
    const settings = await getGuildSettings(supabase, interaction.guildId);
    const channelLine = settings?.welcome_channel_id
      ? `<#${settings.welcome_channel_id}>`
      : "not set (falls back to the server's system channel)";
    const enabledLine = settings?.welcome_enabled === false ? "disabled" : "enabled";

    await interaction.reply({
      content: `**Welcome message**\nChannel: ${channelLine}\nStatus: ${enabledLine}`,
      flags: MessageFlags.Ephemeral,
    });
  },
} satisfies Command;
