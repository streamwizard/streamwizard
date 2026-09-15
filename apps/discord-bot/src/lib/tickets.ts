import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  LabelBuilder,
  MessageFlags,
  ModalBuilder,
  PermissionFlagsBits,
  StringSelectMenuBuilder,
  TextInputBuilder,
  TextInputStyle,
} from "discord.js";
import type {
  ButtonInteraction,
  Guild,
  GuildMember,
  ModalSubmitInteraction,
  SendableChannels,
  TextChannel,
} from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import {
  claimTicket,
  closeTicket,
  createTicket,
  getTicketByChannelId,
  getTicketOpenerProfile,
  getTicketSettings,
  insertTicketEvent,
  nextTicketNumber,
  setTicketGithubIssue,
  TICKET_PRODUCTS,
  type TicketProduct,
  type DiscordTicket,
  type DiscordTicketCategory,
  type DiscordTicketEventType,
  type DiscordTicketSettings,
  type TicketOpenerProfile,
} from "@repo/supabase/queries/tickets";
import { createTicketIssue, getInstallationOctokit } from "@repo/github-api";
import type { DiscordUserRef, PlatformEventPayloads, TicketEventSource } from "@repo/types";
import { env } from "./env";
import { emitServerEvent } from "./server-log/emit";
import { memberRef } from "./server-log/refs";
import { markSelfAction } from "./server-log/self-actions";
import { Sentry } from "../sentry";
import { TWITCH_PURPLE } from "./branding";
import { notifyTicketActivity, trackTicketChannel } from "./ticket-activity";
import { captureTicketTranscript } from "./ticket-transcript";

const TICKET_SUBJECT_MAX = 100;

const ticketChannelName = (ticket: DiscordTicket) => `ticket-${String(ticket.ticket_number).padStart(4, "0")}`;

/** A member as a log payload ref, falling back to the name stored on the ticket when they left. */
async function ticketMemberRef(
  guild: Guild,
  discordUserId: string | null,
  storedName: string | null,
): Promise<DiscordUserRef | null> {
  if (!discordUserId) return null;
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  return member ? memberRef(member) : { id: discordUserId, display_name: storedName };
}

/** The shared part of every ticket.* log payload. */
async function ticketEventPayload(
  guild: Guild,
  ticket: DiscordTicket,
  source: TicketEventSource,
): Promise<PlatformEventPayloads["ticket.opened"]> {
  const opener = (await ticketMemberRef(guild, ticket.opener_discord_user_id, ticket.opener_name)) ?? {
    id: ticket.opener_discord_user_id,
  };
  return {
    guild_id: guild.id,
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    subject: ticket.subject.slice(0, TICKET_SUBJECT_MAX),
    category: ticket.category,
    product: ticket.product,
    opener,
    channel: { id: ticket.channel_id, name: ticketChannelName(ticket), type: "text" },
    source,
    dashboard_url: env.WEB_ADMIN_URL
      ? `${env.WEB_ADMIN_URL.replace(/\/$/, "")}/discord/tickets/${ticket.ticket_number}`
      : null,
  };
}

// Timeline entries are history, not state: a failed write is reported and
// never blocks the ticket action itself. The same moment goes to the Discord
// log channel as a ticket.* event (stored even when the type is turned off,
// so the dashboard viewer keeps it).
async function recordTicketEvent(
  guild: Guild,
  ticket: DiscordTicket,
  type: DiscordTicketEventType,
  actor: GuildMember | null,
  source: TicketEventSource,
): Promise<void> {
  try {
    await insertTicketEvent(supabase, {
      ticketId: ticket.id,
      type,
      actorDiscordId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
    });
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[tickets] Failed to record "${type}" event for ticket ${ticket.id}:`, error);
  }

  const base = await ticketEventPayload(guild, ticket, source);
  const options = {
    subjectDiscordId: ticket.opener_discord_user_id,
    actorDiscordId: actor?.id,
    store: "always" as const,
  };
  if (type === "opened") {
    await emitServerEvent(guild, "ticket.opened", base, options);
  } else if (type === "claimed" && actor) {
    await emitServerEvent(guild, "ticket.claimed", { ...base, actor: memberRef(actor) }, options);
  } else if (type === "closed" && actor) {
    await emitServerEvent(
      guild,
      "ticket.closed",
      {
        ...base,
        actor: memberRef(actor),
        claimer: await ticketMemberRef(guild, ticket.claimed_by_discord_user_id, ticket.claimed_by_name),
        duration_seconds: Math.max(0, Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 1000)),
        message_count: ticket.transcript_message_count,
      },
      options,
    );
  }
}

/** Logs a staff reply sent from the web-admin dashboard. No message content. */
export async function logTicketReply(guild: Guild, ticket: DiscordTicket, authorName: string): Promise<void> {
  const base = await ticketEventPayload(guild, ticket, "dashboard");
  await emitServerEvent(
    guild,
    "ticket.replied",
    { ...base, author_name: authorName },
    { subjectDiscordId: ticket.opener_discord_user_id, store: "always" },
  );
}

// customId namespace for ticket component interactions. interactionCreate routes
// anything starting with "ticket:" here. Handlers are stateless — they look the
// ticket up by channel id — so buttons keep working across bot restarts.
export const TICKET_IDS = {
  create: "ticket:create",
  submit: "ticket:submit",
  claim: "ticket:claim",
  close: "ticket:close",
  closeConfirm: "ticket:close-confirm",
  closeCancel: "ticket:close-cancel",
  github: "ticket:github",
} as const;

const FIELD_IDS = {
  subject: "subject",
  description: "description",
  category: "category",
  product: "product",
} as const;

const CATEGORY_CHOICES: { label: string; value: DiscordTicketCategory; description: string; emoji: string }[] = [
  { label: "Bug", value: "bug", description: "Something is broken or not working", emoji: "🐛" },
  { label: "Feature", value: "feature", description: "Request a new feature or improvement", emoji: "✨" },
  { label: "Support", value: "support", description: "Get help with using StreamWizard", emoji: "💬" },
  { label: "Other", value: "other", description: "Anything else", emoji: "📨" },
];

function productLabel(product: string | null): string {
  const choice = TICKET_PRODUCTS.find((p) => p.value === product);
  return choice ? `${choice.emoji} ${choice.label}` : "Not set";
}

function categoryLabel(category: DiscordTicketCategory): string {
  const choice = CATEGORY_CHOICES.find((c) => c.value === category);
  return choice ? `${choice.emoji} ${choice.label}` : category;
}

// Staff = anyone with the configured staff role, or anyone who can Manage Server
// (so admins always have access even before a staff role is set).
export function isStaff(member: GuildMember, settings: DiscordTicketSettings | null): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return Boolean(settings?.staff_role_id && member.roles.cache.has(settings.staff_role_id));
}

// The persistent panel members click to open a ticket.
export function buildPanelMessage() {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setTitle("Need a hand?")
    .setDescription(
      "Open a support ticket and our team will help you out. Click the button below to get started — we'll spin up a private channel just for you.",
    )
    .setFooter({ text: "StreamWizard Support" });

  const button = new ButtonBuilder()
    .setCustomId(TICKET_IDS.create)
    .setLabel("Create Ticket")
    .setEmoji("🎫")
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

  return { embeds: [embed], components: [row] };
}

type PanelLocation = Pick<DiscordTicketSettings, "panel_channel_id" | "panel_message_id">;

// Removes a previously posted panel message. Errors are swallowed: the message
// or its channel may already be gone.
export async function deleteTicketPanel(guild: Guild, previous: PanelLocation | null): Promise<void> {
  if (!previous?.panel_channel_id || !previous.panel_message_id) return;
  const oldChannel = await guild.channels.fetch(previous.panel_channel_id).catch(() => null);
  if (oldChannel?.isTextBased()) {
    await oldChannel.messages.delete(previous.panel_message_id).catch(() => {});
  }
}

// Posts a fresh panel and removes the one from a previous setup run, so
// re-running setup doesn't leave duplicate "Create Ticket" panels around.
// Returns the new panel's message id.
export async function postTicketPanel(
  guild: Guild,
  channel: SendableChannels,
  previous: PanelLocation | null,
): Promise<string> {
  await deleteTicketPanel(guild, previous);
  const message = await channel.send(buildPanelMessage());
  return message.id;
}

function buildTicketModal(): ModalBuilder {
  const subject = new LabelBuilder()
    .setLabel("Subject")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.subject)
        .setStyle(TextInputStyle.Short)
        .setPlaceholder("A short summary of your issue")
        .setMaxLength(100)
        .setRequired(true),
    );

  const description = new LabelBuilder()
    .setLabel("Description")
    .setTextInputComponent(
      new TextInputBuilder()
        .setCustomId(FIELD_IDS.description)
        .setStyle(TextInputStyle.Paragraph)
        .setPlaceholder("Tell us what's going on, with as much detail as you can")
        .setMaxLength(2000)
        .setRequired(true),
    );

  const category = new LabelBuilder().setLabel("Category").setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(FIELD_IDS.category)
      .setPlaceholder("Pick a category")
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true)
      .addOptions(
        CATEGORY_CHOICES.map((c) => ({ label: c.label, value: c.value, description: c.description, emoji: c.emoji })),
      ),
  );

  const product = new LabelBuilder().setLabel("Product").setStringSelectMenuComponent(
    new StringSelectMenuBuilder()
      .setCustomId(FIELD_IDS.product)
      .setPlaceholder("What is this about?")
      .setMinValues(1)
      .setMaxValues(1)
      .setRequired(true)
      .addOptions(
        TICKET_PRODUCTS.map((p) => ({ label: p.label, value: p.value, description: p.description, emoji: p.emoji })),
      ),
  );

  return new ModalBuilder()
    .setCustomId(TICKET_IDS.submit)
    .setTitle("Create a ticket")
    .addLabelComponents(subject, description, product, category);
}

// Shows whether the opener has a linked StreamWizard account, and who, so staff
// can match the ticket to a StreamWizard user instead of just a Discord handle.
function accountFieldValue(opener: TicketOpenerProfile | null): string {
  if (!opener) return "❌ Not linked";
  return `✅ Linked — **${opener.name}** (${opener.email})`;
}

function buildTicketIntroMessage(
  ticket: DiscordTicket,
  settings: DiscordTicketSettings | null,
  opener: TicketOpenerProfile | null,
) {
  const embed = new EmbedBuilder()
    .setColor(TWITCH_PURPLE)
    .setAuthor({ name: `Ticket #${String(ticket.ticket_number).padStart(4, "0")}` })
    .setTitle(ticket.subject)
    .setDescription(ticket.description)
    .addFields(
      { name: "Product", value: productLabel(ticket.product), inline: true },
      { name: "Category", value: categoryLabel(ticket.category), inline: true },
      { name: "StreamWizard account", value: accountFieldValue(opener), inline: true },
      {
        name: "Claimed by",
        value: ticket.claimed_by_discord_user_id ? `<@${ticket.claimed_by_discord_user_id}>` : "Unclaimed",
        inline: true,
      },
    )
    .setTimestamp(new Date(ticket.created_at));

  // Once claimed, the button becomes a disabled marker showing it's taken.
  const claim = new ButtonBuilder()
    .setCustomId(TICKET_IDS.claim)
    .setEmoji("🙋")
    .setStyle(ButtonStyle.Success)
    .setLabel(ticket.claimed_by_discord_user_id ? "Claimed" : "Claim")
    .setDisabled(Boolean(ticket.claimed_by_discord_user_id));

  const close = new ButtonBuilder()
    .setCustomId(TICKET_IDS.close)
    .setLabel("Close Ticket")
    .setEmoji("🔒")
    .setStyle(ButtonStyle.Danger);

  // Once an issue exists, this becomes a link button instead of an action button.
  const github = ticket.github_issue_url
    ? new ButtonBuilder()
        .setLabel(`Issue #${ticket.github_issue_number}`)
        .setEmoji("🐙")
        .setStyle(ButtonStyle.Link)
        .setURL(ticket.github_issue_url)
    : new ButtonBuilder()
        .setCustomId(TICKET_IDS.github)
        .setLabel("Move to GitHub")
        .setEmoji("🐙")
        .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(claim, close, github);

  const mentions = [`<@${ticket.opener_discord_user_id}>`];
  if (settings?.staff_role_id) mentions.push(`<@&${settings.staff_role_id}>`);

  return { content: mentions.join(" "), embeds: [embed], components: [row] };
}

export async function handleCreateButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  await interaction.showModal(buildTicketModal());
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!settings?.enabled || !settings.category_id || !settings.staff_role_id) {
    await interaction.reply({ content: "Ticketing isn't set up in this server yet.", flags: MessageFlags.Ephemeral });
    return;
  }

  const subject = interaction.fields.getTextInputValue(FIELD_IDS.subject);
  const description = interaction.fields.getTextInputValue(FIELD_IDS.description);
  const category = interaction.fields.getStringSelectValues(FIELD_IDS.category)[0] as DiscordTicketCategory;
  const pickedProduct = interaction.fields.getStringSelectValues(FIELD_IDS.product)[0];
  const product: TicketProduct = TICKET_PRODUCTS.find((p) => p.value === pickedProduct)?.value ?? "other";

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, interaction.user.id);
  const openerUserId = integration?.user_id ?? null;
  const openerProfile = openerUserId ? await getTicketOpenerProfile(supabase, openerUserId) : null;
  const ticketNumber = await nextTicketNumber(supabase, interaction.guildId);

  const channel = await interaction.guild.channels.create({
    name: `ticket-${String(ticketNumber).padStart(4, "0")}`,
    type: ChannelType.GuildText,
    parent: settings.category_id,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      {
        id: interaction.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: settings.staff_role_id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
        ],
      },
      {
        id: interaction.client.user.id,
        allow: [
          PermissionFlagsBits.ViewChannel,
          PermissionFlagsBits.SendMessages,
          PermissionFlagsBits.ReadMessageHistory,
          PermissionFlagsBits.ManageChannels,
        ],
      },
    ],
  });
  // The server log would otherwise report the new channel as a staff action.
  markSelfAction("channel", channel.id);

  // If the ticket row or intro message fails, the channel would be left behind
  // with nothing tracking it — remove it (and close the row, if it got that far)
  // and let the handler report the error. The allocated ticket number is skipped.
  let ticketCreated = false;
  try {
    const ticket = await createTicket(supabase, {
      guildId: interaction.guildId,
      ticketNumber,
      channelId: channel.id,
      openerDiscordUserId: interaction.user.id,
      openerUserId,
      subject,
      description,
      category,
      product,
      openerName: interaction.member.displayName,
    });
    ticketCreated = true;
    await recordTicketEvent(interaction.guild, ticket, "opened", interaction.member, "discord");
    trackTicketChannel(interaction.guildId, channel.id, ticket.ticket_number);
    void notifyTicketActivity(interaction.guildId, channel.id, "opened", ticket.ticket_number);

    await channel.send(buildTicketIntroMessage(ticket, settings, openerProfile));
  } catch (error) {
    if (ticketCreated) {
      await closeTicket(supabase, channel.id, interaction.client.user.id, interaction.client.user.username).catch(
        () => {},
      );
    }
    await channel.delete("Ticket creation failed").catch(() => {});
    throw error;
  }

  await interaction.editReply({ content: `✅ Your ticket is open: <#${channel.id}>` });
}

export async function handleClaimButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can claim tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const claimed = await claimTicket(
    supabase,
    interaction.channelId,
    interaction.user.id,
    interaction.member.displayName,
  );

  // Race-safe: claimTicket returns null if it was already claimed (or not a ticket).
  if (!claimed) {
    const current = await getTicketByChannelId(supabase, interaction.channelId);
    const message = current?.claimed_by_discord_user_id
      ? `This ticket is already claimed by <@${current.claimed_by_discord_user_id}>.`
      : "This channel isn't a tracked ticket.";
    await interaction.reply({ content: message, flags: MessageFlags.Ephemeral });
    return;
  }

  await recordTicketEvent(interaction.guild, claimed, "claimed", interaction.member, "discord");
  void notifyTicketActivity(interaction.guildId, claimed.channel_id, "claimed", claimed.ticket_number);

  const opener = claimed.opener_user_id ? await getTicketOpenerProfile(supabase, claimed.opener_user_id) : null;
  // Edit the intro message in place so the claim state + disabled button update for everyone.
  await interaction.update(buildTicketIntroMessage(claimed, settings, opener));
  await interaction.followUp({ content: `🙋 You claimed this ticket.`, flags: MessageFlags.Ephemeral });
}

export type ClaimTicketResult =
  | { status: "claimed" }
  | { status: "already_claimed"; claimedBy: string }
  | { status: "not_a_ticket" };

/**
 * Claims a ticket as `member` without a button interaction (web-admin
 * dashboard). Same DB write and timeline event as the Claim button, and the
 * intro message is edited so the channel shows who claimed it.
 */
export async function claimTicketAs(
  channel: TextChannel,
  member: GuildMember,
  source: TicketEventSource = "discord",
): Promise<ClaimTicketResult> {
  const claimed = await claimTicket(supabase, channel.id, member.id, member.displayName);
  if (!claimed) {
    const current = await getTicketByChannelId(supabase, channel.id);
    if (!current) return { status: "not_a_ticket" };
    return {
      status: "already_claimed",
      claimedBy: current.claimed_by_name ?? current.claimed_by_discord_user_id ?? "someone",
    };
  }

  await recordTicketEvent(channel.guild, claimed, "claimed", member, source);
  void notifyTicketActivity(channel.guild.id, channel.id, "claimed", claimed.ticket_number);

  // The intro is the bot's oldest message carrying the Claim button.
  const firstMessages = await channel.messages.fetch({ after: "0", limit: 10 }).catch(() => null);
  const intro = firstMessages?.find(
    (message) =>
      message.author.id === channel.client.user.id &&
      message.components.some(
        (row) => "components" in row && row.components.some((c) => "customId" in c && c.customId === TICKET_IDS.claim),
      ),
  );
  if (intro) {
    const settings = await getTicketSettings(supabase, channel.guild.id);
    const opener = claimed.opener_user_id ? await getTicketOpenerProfile(supabase, claimed.opener_user_id) : null;
    await intro
      .edit(buildTicketIntroMessage(claimed, settings, opener))
      .catch((error) => Sentry.captureException(error));
  }
  await channel.send({ content: `🙋 ${member} claimed this ticket.`, allowedMentions: { parse: [] } }).catch(() => {});
  return { status: "claimed" };
}

export async function handleGithubButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can move tickets to GitHub.", flags: MessageFlags.Ephemeral });
    return;
  }

  const ticket = await getTicketByChannelId(supabase, interaction.channelId);
  if (!ticket) {
    await interaction.reply({ content: "This channel isn't a tracked ticket.", flags: MessageFlags.Ephemeral });
    return;
  }
  if (ticket.github_issue_url) {
    await interaction.reply({
      content: `This ticket is already on GitHub: ${ticket.github_issue_url}`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const { GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY, GITHUB_APP_INSTALLATION_ID, GITHUB_ISSUES_REPO } = env;
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY || !GITHUB_APP_INSTALLATION_ID || !GITHUB_ISSUES_REPO) {
    await interaction.reply({
      content: "GitHub isn't set up for this bot, so tickets can't be moved there.",
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.deferUpdate();

  // The issue may live in a public repo, so it never carries the opener's name
  // or email — staff can match the ticket to a user from the Discord channel.
  const body = [
    ticket.description,
    "",
    `**Product:** ${productLabel(ticket.product)}`,
    `**Category:** ${categoryLabel(ticket.category)}`,
    `**Discord ticket:** #${String(ticket.ticket_number).padStart(4, "0")}`,
    `**StreamWizard account:** ${ticket.opener_user_id ? "linked" : "not linked"}`,
  ].join("\n");

  const octokit = getInstallationOctokit({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_APP_PRIVATE_KEY,
    installationId: GITHUB_APP_INSTALLATION_ID,
  });
  const issue = await createTicketIssue(octokit, GITHUB_ISSUES_REPO, { title: ticket.subject, body });

  await setTicketGithubIssue(supabase, ticket.channel_id, issue.number, issue.url);

  const updated = await getTicketByChannelId(supabase, ticket.channel_id);
  if (updated) {
    const opener = updated.opener_user_id ? await getTicketOpenerProfile(supabase, updated.opener_user_id) : null;
    await interaction.editReply(buildTicketIntroMessage(updated, settings, opener));
  }
  await interaction.followUp({
    content: `🐙 Created GitHub issue #${issue.number}: ${issue.url}`,
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCloseButton(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.reply({ content: "Only staff can close tickets.", flags: MessageFlags.Ephemeral });
    return;
  }

  const confirm = new ButtonBuilder()
    .setCustomId(TICKET_IDS.closeConfirm)
    .setLabel("Close it")
    .setStyle(ButtonStyle.Danger);
  const cancel = new ButtonBuilder()
    .setCustomId(TICKET_IDS.closeCancel)
    .setLabel("Cancel")
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(confirm, cancel);

  await interaction.reply({
    content: "Close this ticket? The channel will be deleted.",
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleCloseCancel(interaction: ButtonInteraction): Promise<void> {
  await interaction.update({ content: "Cancelled — the ticket stays open.", components: [] });
}

export type CloseTicketResult = "closed" | "not_a_ticket" | "already_closed" | "transcript_failed";

export const CLOSE_RESULT_MESSAGES: Record<Exclude<CloseTicketResult, "closed">, string> = {
  not_a_ticket: "This channel isn't a tracked ticket.",
  already_closed: "This ticket was already closed.",
  transcript_failed:
    "Couldn't save this ticket's transcript, so the channel stays open. Try closing it again in a minute.",
};

// Shared by the close-confirm button and the /ticket close command. The
// transcript is saved before anything else: if that fails the ticket stays
// open and the channel isn't deleted, so no conversation is ever lost.
export async function closeTicketChannel(
  channel: TextChannel,
  closedBy: GuildMember,
  source: TicketEventSource = "discord",
): Promise<CloseTicketResult> {
  const ticket = await getTicketByChannelId(supabase, channel.id);
  if (!ticket) return "not_a_ticket";
  if (ticket.status !== "open") return "already_closed";

  let messageCount: number;
  try {
    messageCount = await captureTicketTranscript(channel, ticket);
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[tickets] Failed to save transcript for ticket #${ticket.ticket_number}:`, error);
    return "transcript_failed";
  }

  // Two staff closing at once: only the first update wins; the other leaves
  // the channel to the winner.
  const closed = await closeTicket(supabase, channel.id, closedBy.id, closedBy.displayName);
  if (!closed) return "already_closed";
  await recordTicketEvent(
    channel.guild,
    { ...closed, transcript_message_count: messageCount },
    "closed",
    closedBy,
    source,
  );
  trackTicketChannel(channel.guild.id, channel.id, null);
  void notifyTicketActivity(channel.guild.id, channel.id, "closed", ticket.ticket_number);

  await channel.delete(`Ticket closed by ${closedBy.user.tag}`);
  return "closed";
}

export async function handleCloseConfirm(interaction: ButtonInteraction): Promise<void> {
  if (!interaction.inCachedGuild()) return;

  const settings = await getTicketSettings(supabase, interaction.guildId);
  if (!isStaff(interaction.member, settings)) {
    await interaction.update({ content: "Only staff can close tickets.", components: [] });
    return;
  }

  if (interaction.channel?.type !== ChannelType.GuildText) {
    await interaction.update({ content: "This isn't a ticket channel.", components: [] });
    return;
  }

  await interaction.update({ content: "Closing this ticket…", components: [] });

  const result = await closeTicketChannel(interaction.channel, interaction.member);
  if (result !== "closed") {
    await interaction.editReply({ content: CLOSE_RESULT_MESSAGES[result] });
  }
}

// Single entry point used by interactionCreate for all ticket: component interactions.
export async function handleTicketInteraction(interaction: ButtonInteraction | ModalSubmitInteraction): Promise<void> {
  try {
    if (interaction.isModalSubmit()) {
      if (interaction.customId === TICKET_IDS.submit) await handleModalSubmit(interaction);
      return;
    }

    switch (interaction.customId) {
      case TICKET_IDS.create:
        await handleCreateButton(interaction);
        break;
      case TICKET_IDS.claim:
        await handleClaimButton(interaction);
        break;
      case TICKET_IDS.github:
        await handleGithubButton(interaction);
        break;
      case TICKET_IDS.close:
        await handleCloseButton(interaction);
        break;
      case TICKET_IDS.closeConfirm:
        await handleCloseConfirm(interaction);
        break;
      case TICKET_IDS.closeCancel:
        await handleCloseCancel(interaction);
        break;
    }
  } catch (error) {
    Sentry.captureException(error);
    console.error(`[tickets] Error handling "${interaction.customId}":`, error);

    const payload = {
      content: "Something went wrong with that ticket action.",
      flags: MessageFlags.Ephemeral,
    } as const;
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(payload).catch(() => {});
    } else if (!interaction.isModalSubmit() || interaction.isFromMessage()) {
      await interaction.reply(payload).catch(() => {});
    }
  }
}
