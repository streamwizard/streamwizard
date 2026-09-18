import { InteractionContextType, MessageFlags, SlashCommandBuilder } from "discord.js";
import { replaceVariables } from "@repo/discord-message";
import type { Command } from "../types/discord";
import { guildVariableValues, memberVariableValues } from "../lib/built-message";
import { getTicketConfig, isStaff, searchTags } from "../lib/tickets";

// A canned answer, posted where the command is run. Tags are edited in
// web-admin under Discord, Tickets, Tags; the list here comes from the same
// cache the ticket flows read.
export default {
  data: new SlashCommandBuilder()
    .setName("tag")
    .setDescription("Staff: post a canned answer")
    .setContexts(InteractionContextType.Guild)
    .addStringOption((opt) => opt.setName("name").setDescription("Which one").setRequired(true).setAutocomplete(true))
    .addUserOption((opt) => opt.setName("for").setDescription("Who it's for: they get mentioned and [member.*] is them")),

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return void (await interaction.respond([]));
    const { tags } = await getTicketConfig(interaction.guildId);
    await interaction.respond(searchTags(tags, interaction.options.getFocused()).map((tag) => ({ name: tag.name, value: tag.name })));
  },

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const config = await getTicketConfig(interaction.guildId);
    if (!isStaff(interaction.member, config.settings)) {
      await interaction.reply({ content: "Only staff can post tags.", flags: MessageFlags.Ephemeral });
      return;
    }
    const name = interaction.options.getString("name", true).trim().toLowerCase();
    const tag = config.tags.find((candidate) => candidate.name === name);
    if (!tag) {
      await interaction.reply({ content: `There's no tag called \`${name.slice(0, 32)}\`. Tags live in web-admin under Tickets, Tags.`, flags: MessageFlags.Ephemeral });
      return;
    }

    const target = interaction.options.getMember("for") ?? interaction.member;
    const content = replaceVariables(tag.content, { ...guildVariableValues(interaction.guild), ...memberVariableValues(target) });
    await interaction.reply({ content: content.slice(0, 2000), allowedMentions: { parse: [], users: [target.id] } });
  },
} satisfies Command;
