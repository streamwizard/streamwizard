import { ChannelType, InteractionContextType, MessageFlags, SlashCommandBuilder, escapeMarkdown } from "discord.js";
import type { ChatInputCommandInteraction, GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { isActiveCategory } from "@repo/supabase/queries/ticket-config";
import { isTicketPriority, listTicketsForOpener, TICKET_PRIORITIES } from "@repo/supabase/queries/ticket-lifecycle";
import { formatTicketNumber } from "@repo/supabase/queries/tickets";
import type { Command } from "../types/discord";
import {
  addMember,
  buildTranscriptFile,
  changePriority,
  changeSubject,
  claimTicketAs,
  CLOSE_REASON_MAX,
  CLOSE_RESULT_MESSAGES,
  closeTicketChannel,
  describeDiscordError,
  getTicketConfig,
  handleCreate,
  isStaff,
  loadTicketContext,
  moveTicket,
  releaseTicket,
  removeMember,
  transferTicket,
  type TicketActionResult,
} from "../lib/tickets";

type Interaction = ChatInputCommandInteraction<"cached">;

const ephemeral = (interaction: Interaction, content: string) =>
  interaction.reply({ content, flags: MessageFlags.Ephemeral });

/** Runs a staff action on the ticket in this channel and answers with what happened. */
async function staffAction(
  interaction: Interaction,
  done: string,
  action: (channel: TextChannel, actor: GuildMember) => Promise<TicketActionResult>,
): Promise<void> {
  if (interaction.channel?.type !== ChannelType.GuildText) return void (await ephemeral(interaction, "This isn't a ticket channel."));
  const context = await loadTicketContext(interaction.channel);
  if (!context) return void (await ephemeral(interaction, "This channel isn't an open ticket."));
  if (!isStaff(interaction.member, context.config.settings, context.category)) {
    return void (await ephemeral(interaction, "Only staff can do that."));
  }

  // Permission and channel edits can outlast Discord's three seconds.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await action(interaction.channel, interaction.member);
    await interaction.editReply({ content: result.ok ? done : result.message });
  } catch (error) {
    const known = describeDiscordError(error);
    if (!known) throw error;
    await interaction.editReply({ content: known });
  }
}

// Everyone's ticket command. No default member permissions: members need
// `new` and `list`, staff need the rest, and Discord can't hide subcommands
// one by one. Each subcommand checks who is asking. Setting tickets up lives
// in /ticket-admin, which Discord can hide.
export default {
  data: new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Open a support ticket, or work the one in this channel")
    .setContexts(InteractionContextType.Guild)
    .addSubcommand((sub) =>
      sub
        .setName("new")
        .setDescription("Open a support ticket")
        .addStringOption((opt) => opt.setName("category").setDescription("What it is about").setAutocomplete(true)),
    )
    .addSubcommand((sub) => sub.setName("list").setDescription("Your open tickets and the last ones that closed"))
    .addSubcommand((sub) =>
      sub
        .setName("close")
        .setDescription("Staff: close the ticket in this channel")
        .addStringOption((opt) =>
          opt.setName("reason").setDescription("Why it is closing. Saved on the ticket.").setMaxLength(CLOSE_REASON_MAX),
        ),
    )
    .addSubcommand((sub) => sub.setName("claim").setDescription("Staff: take this ticket"))
    .addSubcommand((sub) => sub.setName("release").setDescription("Staff: give this ticket back so someone else can claim it"))
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Staff: let someone else into this ticket")
        .addUserOption((opt) => opt.setName("member").setDescription("Who to add").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Staff: take someone you added back out")
        .addUserOption((opt) => opt.setName("member").setDescription("Who to remove").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("transfer")
        .setDescription("Staff: hand this ticket to another member, who becomes its owner")
        .addUserOption((opt) => opt.setName("member").setDescription("The new owner").setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("move")
        .setDescription("Staff: file this ticket under another category")
        .addStringOption((opt) =>
          opt.setName("category").setDescription("Where it belongs").setRequired(true).setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("priority")
        .setDescription("Staff: mark how urgent this ticket is")
        .addStringOption((opt) =>
          opt
            .setName("level")
            .setDescription("How urgent")
            .setRequired(true)
            .addChoices(
              ...TICKET_PRIORITIES.map((level) => ({ name: level, value: level })),
              { name: "none", value: "none" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("subject")
        .setDescription("Staff: reword this ticket's subject")
        .addStringOption((opt) => opt.setName("text").setDescription("The new subject").setRequired(true).setMaxLength(100)),
    )
    .addSubcommand((sub) => sub.setName("transcript").setDescription("This ticket's conversation so far, as a file (only you see it)")),

  async autocomplete(interaction) {
    if (!interaction.inCachedGuild()) return void (await interaction.respond([]));
    const typed = interaction.options.getFocused().toLowerCase();
    const { categories } = await getTicketConfig(interaction.guildId);
    await interaction.respond(
      categories
        .filter((c) => isActiveCategory(c) && (c.name.toLowerCase().includes(typed) || c.slug.includes(typed)))
        .slice(0, 25)
        .map((c) => ({ name: c.name, value: c.slug })),
    );
  },

  async execute(interaction) {
    if (!interaction.inCachedGuild()) {
      await interaction.reply({ content: "This command can only be used in a server.", flags: MessageFlags.Ephemeral });
      return;
    }
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "new") {
      await handleCreate(interaction, interaction.options.getString("category"));
      return;
    }

    if (subcommand === "list") {
      const [tickets, { categories }] = await Promise.all([
        listTicketsForOpener(supabase, interaction.guildId, interaction.user.id),
        getTicketConfig(interaction.guildId),
      ]);
      if (tickets.length === 0) return void (await ephemeral(interaction, "You haven't opened any tickets here."));
      const lines = tickets.map((ticket) => {
        const category = categories.find((c) => c.slug === ticket.category)?.name ?? ticket.category;
        const where = ticket.status === "open" ? `<#${ticket.channel_id}>` : "closed";
        return `**${formatTicketNumber(ticket.ticket_number)}** ${escapeMarkdown(ticket.subject)} · ${category} · ${where}`;
      });
      await ephemeral(interaction, lines.join("\n").slice(0, 2000));
      return;
    }

    if (subcommand === "close") {
      if (interaction.channel?.type !== ChannelType.GuildText) return void (await ephemeral(interaction, "This isn't a ticket channel."));
      const context = await loadTicketContext(interaction.channel);
      if (!context) return void (await ephemeral(interaction, CLOSE_RESULT_MESSAGES.not_a_ticket));
      if (!isStaff(interaction.member, context.config.settings, context.category)) {
        return void (await ephemeral(interaction, "Only staff can close tickets."));
      }

      // Acknowledge before deleting the channel, otherwise the reply target disappears.
      await ephemeral(interaction, "Closing this ticket…");
      const reason = interaction.options.getString("reason")?.trim() || null;
      const result = await closeTicketChannel(interaction.channel, interaction.member, "discord", reason);
      if (result !== "closed") await interaction.editReply({ content: CLOSE_RESULT_MESSAGES[result] });
      return;
    }

    if (subcommand === "claim") {
      await staffAction(interaction, "🙋 You claimed this ticket.", async (channel, actor) => {
        const claim = await claimTicketAs(channel, actor);
        if (claim.status === "claimed") return { ok: true, ticket: (await loadTicketContext(channel))!.ticket };
        return {
          ok: false,
          message: claim.status === "already_claimed" ? `Already claimed by ${claim.claimedBy}.` : CLOSE_RESULT_MESSAGES.not_a_ticket,
        };
      });
      return;
    }

    if (subcommand === "release") {
      await staffAction(interaction, "Released.", (channel, actor) => releaseTicket(channel, actor));
      return;
    }

    if (subcommand === "add" || subcommand === "transfer") {
      const target = interaction.options.getMember("member");
      if (!target) return void (await ephemeral(interaction, "That person isn't in this server."));
      await staffAction(interaction, subcommand === "add" ? `Added ${target.displayName}.` : `Handed to ${target.displayName}.`, (channel, actor) =>
        subcommand === "add" ? addMember(channel, actor, target) : transferTicket(channel, actor, target),
      );
      return;
    }

    if (subcommand === "remove") {
      // They may have left the server since; removing them from the ticket still works.
      const user = interaction.options.getUser("member", true);
      const displayName = interaction.options.getMember("member")?.displayName ?? user.username;
      await staffAction(interaction, `Removed ${displayName}.`, (channel, actor) =>
        removeMember(channel, actor, { id: user.id, displayName }),
      );
      return;
    }

    if (subcommand === "move") {
      const slug = interaction.options.getString("category", true);
      await staffAction(interaction, "Moved.", (channel, actor) => moveTicket(channel, actor, slug));
      return;
    }

    if (subcommand === "priority") {
      const level = interaction.options.getString("level", true);
      await staffAction(interaction, level === "none" ? "Priority cleared." : `Priority set to ${level}.`, (channel, actor) =>
        changePriority(channel, actor, isTicketPriority(level) ? level : null),
      );
      return;
    }

    if (subcommand === "subject") {
      const text = interaction.options.getString("text", true);
      await staffAction(interaction, "Subject changed.", (channel, actor) => changeSubject(channel, actor, text));
      return;
    }

    if (subcommand === "transcript") {
      if (interaction.channel?.type !== ChannelType.GuildText) return void (await ephemeral(interaction, "This isn't a ticket channel."));
      const context = await loadTicketContext(interaction.channel);
      if (!context) return void (await ephemeral(interaction, CLOSE_RESULT_MESSAGES.not_a_ticket));
      const allowed =
        context.ticket.opener_discord_user_id === interaction.user.id ||
        isStaff(interaction.member, context.config.settings, context.category);
      if (!allowed) return void (await ephemeral(interaction, "Only the opener and staff can get the transcript."));

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });
      const file = await buildTranscriptFile(interaction.guild, context.ticket, context.config);
      await interaction.editReply({ content: "The conversation so far.", files: [file] });
    }
  },
} satisfies Command;
