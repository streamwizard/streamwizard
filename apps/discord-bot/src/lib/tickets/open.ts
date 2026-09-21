import { ActionRowBuilder, ChannelType, MessageFlags, StringSelectMenuBuilder } from "discord.js";
import type {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Guild,
  GuildMember,
  MessageContextMenuCommandInteraction,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
  User,
  UserContextMenuCommandInteraction,
} from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import { insertTicketAnswers, type TicketCategory } from "@repo/supabase/queries/ticket-config";
import {
  closeTicket,
  createTicket,
  getTicketOpenerProfile,
  nextTicketNumber,
  ticketChannelName,
} from "@repo/supabase/queries/tickets";
import { countOpenTicketsInCategory, getOpenerTicketStats } from "@repo/supabase/queries/ticket-lifecycle";
import { reportError } from "@repo/sentry";
import { expireReply } from "../ephemeral";
import { markSelfAction } from "../server-log/self-actions";
import { computeTicketOverwrites, renderChannelName, whyCannotOpen } from "./access";
import { trackTicketChannel } from "../ticket-activity";
import {
  activeCategories,
  activeProducts,
  categoryFields,
  getTicketConfig,
  ticketsReady,
  type TicketConfig,
} from "./config";
import { recordTicketEvent } from "./events";
import { buildTicketModal, readTicketForm, storedDescription, type FormReader, type TicketFormResult } from "./form";
import { FIELD_IDS, TICKET_IDS } from "./ids";
import { buildTicketIntroMessage } from "./intro";
import { peekPendingOpen, takePendingOpen } from "./pending";
import { ticketStatsValues } from "./stats";

const NOT_SET_UP = "Ticketing isn't set up in this server yet.";
const NOT_FROM_DM = "Tickets can't be opened from a DM here. Head to the server and use the ticket panel.";
const CATEGORY_GONE = "That ticket category isn't available anymore. Hit Create Ticket again to pick another.";
const FORM_CHANGED = "The ticket form changed while you had it open. Hit Create Ticket again, it only takes a moment.";

/** Where a ticket can start. All of these can show the form. */
type OpenInteraction =
  | ButtonInteraction
  | StringSelectMenuInteraction
  | ChatInputCommandInteraction
  | MessageContextMenuCommandInteraction
  | UserContextMenuCommandInteraction;

type AnyOpenInteraction = OpenInteraction | ModalSubmitInteraction;

/**
 * Picked from the bot's own ephemeral "which category?" prompt, directly or
 * through the form it led to. Answers then replace that prompt instead of
 * stacking a second ephemeral message under it.
 */
function fromPicker(interaction: AnyOpenInteraction) {
  const onMessage = interaction.isStringSelectMenu() || (interaction.isModalSubmit() && interaction.isFromMessage());
  return onMessage && interaction.message.flags.has(MessageFlags.Ephemeral) ? interaction : null;
}

/** A one-off ephemeral answer that removes itself after a few minutes. */
async function answer(interaction: AnyOpenInteraction, content: string): Promise<void> {
  if (!(await inPlace(interaction, (picker) => picker.update({ content, components: [] })))) {
    await interaction.reply({ content, flags: MessageFlags.Ephemeral });
  }
  expireReply(interaction);
}

/** Acknowledges before the slow part. `finish` then writes the answer. */
async function defer(interaction: AnyOpenInteraction): Promise<void> {
  if (!(await inPlace(interaction, (picker) => picker.deferUpdate()))) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  }
}

/**
 * Runs `respond` on the prompt when there is one. False when there isn't, or
 * when the prompt already expired while the form was open, so the caller
 * answers with a fresh message instead.
 */
async function inPlace(
  interaction: AnyOpenInteraction,
  respond: (picker: NonNullable<ReturnType<typeof fromPicker>>) => Promise<unknown>,
): Promise<boolean> {
  const picker = fromPicker(interaction);
  if (!picker) return false;
  try {
    await respond(picker);
    return true;
  } catch (error) {
    if (interaction.replied || interaction.deferred) throw error;
    return false;
  }
}

async function finish(interaction: AnyOpenInteraction, content: string): Promise<void> {
  await interaction.editReply({ content, components: [] });
  expireReply(interaction);
}

/**
 * Who is opening a ticket, and for whom. Resolved once per interaction, so
 * the rest of the flow never asks whether it came from a server or a DM.
 */
export interface OpenContext {
  guild: Guild;
  config: TicketConfig;
  /** Who is clicking. */
  member: GuildMember;
  /** Whose ticket it becomes: the member, unless staff open one for someone else. */
  opener: GuildMember;
}

/**
 * The single server a DM can open tickets in: the one that turned DM tickets
 * on and has this person as a member. Null when there is none.
 */
export async function findDmTicketGuild(client: Client<true>, user: User): Promise<{ guild: Guild; member: GuildMember; config: TicketConfig } | null> {
  for (const guild of client.guilds.cache.values()) {
    const config = await getTicketConfig(guild.id);
    if (!config.settings?.dm_open_enabled) continue;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (member) return { guild, member, config };
  }
  return null;
}

async function resolveContext(interaction: OpenInteraction | ModalSubmitInteraction): Promise<OpenContext | null> {
  let guild: Guild;
  let member: GuildMember;
  let config: TicketConfig;
  if (interaction.inCachedGuild()) {
    guild = interaction.guild;
    member = interaction.member;
    config = await getTicketConfig(guild.id);
  } else {
    const found = await findDmTicketGuild(interaction.client, interaction.user);
    if (!found) return null;
    ({ guild, member, config } = found);
  }

  // Staff opening a ticket for someone: the pending note says who.
  const onBehalfOfId = peekPendingOpen(guild.id, member.id)?.onBehalfOfId;
  const opener = onBehalfOfId ? await guild.members.fetch(onBehalfOfId).catch(() => null) : member;
  return { guild, config, member, opener: opener ?? member };
}

function buildCategoryPicker(categories: TicketCategory[]) {
  const select = new StringSelectMenuBuilder()
    .setCustomId(TICKET_IDS.pickCategory)
    .setPlaceholder("Pick a category")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      categories.map((category) => ({
        label: category.name,
        value: category.slug,
        // Discord rejects an empty description, so it is left off.
        ...(category.description ? { description: category.description } : {}),
        ...(category.emoji ? { emoji: category.emoji } : {}),
      })),
    );

  return {
    content: "What kind of ticket is this?",
    components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select)],
    flags: MessageFlags.Ephemeral,
  } as const;
}

/** Shows the category's form, or opens the ticket straight away when the form asks nothing. */
async function startTicket(interaction: OpenInteraction, context: OpenContext, category: TicketCategory): Promise<void> {
  const { config } = context;
  const pending = peekPendingOpen(context.guild.id, context.member.id);
  const modal = buildTicketModal(category, categoryFields(config, category), activeProducts(config), {
    description: pending?.description,
  });
  if (modal) {
    await interaction.showModal(modal);
    return;
  }
  await defer(interaction);
  await openTicket(interaction, context, category, {
    subject: category.name,
    description: pending?.description ?? "",
    product: null,
    answers: [],
  });
}

/**
 * The panel. With a category slug (a per-category button, a select menu
 * option) it goes to that category. Bare (the single Create Ticket button,
 * including panels posted before categories were configurable, and the DM
 * button) it asks which category first, unless there is only one.
 */
export async function handleCreate(interaction: OpenInteraction, slug: string | null): Promise<void> {
  const context = await resolveContext(interaction);
  if (!context) {
    await answer(interaction, NOT_FROM_DM);
    return;
  }
  const { config } = context;
  const categories = activeCategories(config);
  if (!ticketsReady(config.settings) || categories.length === 0) {
    await answer(interaction, NOT_SET_UP);
    return;
  }

  if (slug === null && categories.length > 1) {
    await interaction.reply(buildCategoryPicker(categories));
    expireReply(interaction);
    return;
  }

  const category = slug === null ? categories[0] : categories.find((c) => c.slug === slug);
  if (!category) {
    await answer(interaction, CATEGORY_GONE);
    return;
  }

  // Checked before the form, so nobody fills one in only to be turned away.
  const refusal = await whyNot(context, category);
  if (refusal) {
    await answer(interaction, refusal);
    return;
  }
  await startTicket(interaction, context, category);
}

/** Why the opener can't have a ticket in `category` right now. Null when they can. */
async function whyNot({ guild, config, opener }: OpenContext, category: TicketCategory): Promise<string | null> {
  if (!config.settings) return NOT_SET_UP;
  const parentId = category.discord_category_id ?? config.settings.category_id;
  const [stats, openInCategory] = await Promise.all([
    getOpenerTicketStats(supabase, guild.id, opener.id),
    countOpenTicketsInCategory(supabase, guild.id, category.slug),
  ]);
  return whyCannotOpen({
    member: {
      roleIds: [...opener.roles.cache.keys()],
      timedOut: opener.isCommunicationDisabled(),
    },
    settings: config.settings,
    category,
    stats,
    openInCategory,
    channelsInParent: guild.channels.cache.filter((channel) => channel.parentId === parentId).size,
  });
}

export async function handleCreateButton(interaction: ButtonInteraction, slug: string | null): Promise<void> {
  await handleCreate(interaction, slug);
}

/** A category chosen from a select: the bot's own "which category?" prompt, or a menu-style panel. */
export async function handleCategoryPick(interaction: StringSelectMenuInteraction): Promise<void> {
  await handleCreate(interaction, interaction.values[0] ?? null);

  // A menu on the panel keeps showing this member's pick. Sending the same
  // components again clears it, so the next ticket starts from the placeholder.
  if (interaction.inGuild() && !interaction.message.flags.has(MessageFlags.Ephemeral)) {
    const rows = interaction.message.components.map((row) => row.toJSON());
    await interaction.message.edit({ components: rows }).catch(() => {});
  }
}

/** Reads a submitted modal by field id. A field the modal never had reads as null. */
function modalReader(interaction: ModalSubmitInteraction): FormReader {
  const has = (id: string) => interaction.fields.fields.has(id);
  return {
    text: (id) => (has(id) ? interaction.fields.getTextInputValue(id) : null),
    select: (id) => (has(id) ? (interaction.fields.getStringSelectValues(id)[0] ?? "") : null),
  };
}

/**
 * A form opened before forms were configurable asks under fixed ids instead of
 * field ids. It is read by kind, so a member mid-form during that deploy still
 * gets their ticket.
 */
function legacyReader(interaction: ModalSubmitInteraction, config: TicketConfig, category: TicketCategory): FormReader {
  const byId = new Map(categoryFields(config, category).map((field) => [field.id, field.kind]));
  const legacyId = (id: string) => {
    const kind = byId.get(id);
    return kind === "subject" || kind === "description" || kind === "product" ? FIELD_IDS[kind] : null;
  };
  const has = (id: string | null): id is string => id !== null && interaction.fields.fields.has(id);
  return {
    text: (id) => (has(legacyId(id)) ? interaction.fields.getTextInputValue(legacyId(id)!) : null),
    select: (id) => (has(legacyId(id)) ? (interaction.fields.getStringSelectValues(legacyId(id)!)[0] ?? "") : null),
  };
}

export async function handleModalSubmit(interaction: ModalSubmitInteraction, slug: string | null): Promise<void> {
  const context = await resolveContext(interaction);
  if (!context) {
    await answer(interaction, NOT_FROM_DM);
    return;
  }
  const { config } = context;
  if (!ticketsReady(config.settings)) {
    await answer(interaction, NOT_SET_UP);
    return;
  }

  // A bare submit id is a form from before the category moved out of the modal.
  const isLegacy = slug === null;
  const pickedSlug =
    slug ??
    (interaction.fields.fields.has(FIELD_IDS.category)
      ? interaction.fields.getStringSelectValues(FIELD_IDS.category)[0]
      : null);
  const category = activeCategories(config).find((c) => c.slug === pickedSlug);
  if (!category) {
    await answer(interaction, CATEGORY_GONE);
    return;
  }

  const form = readTicketForm(
    category,
    categoryFields(config, category),
    activeProducts(config),
    isLegacy ? legacyReader(interaction, config, category) : modalReader(interaction),
  );
  if (form === "stale") {
    await answer(interaction, FORM_CHANGED);
    return;
  }

  // Defer ephemerally: channel creation + DB writes can take a moment.
  await defer(interaction);
  await openTicket(interaction, context, category, form);
}

/** Creates the channel, the ticket row and the opening message. The interaction is already deferred. */
async function openTicket(
  interaction: OpenInteraction | ModalSubmitInteraction,
  context: OpenContext,
  category: TicketCategory,
  form: TicketFormResult,
): Promise<void> {
  const { config, opener } = context;
  const { settings } = config;
  // Where the channel goes: the category's own Discord category, else the server-wide one.
  const parent = category.discord_category_id ?? settings?.category_id;
  if (!ticketsReady(settings) || !parent) {
    await finish(interaction, NOT_SET_UP);
    return;
  }

  // Again, now that it counts: the form can sit open for minutes, and a
  // double-click submits twice. The second submit waits here for the first.
  const refusal = await serialised(opener.id, async () => {
    const reason = await whyNot(context, category);
    if (!reason) reserved.add(opener.id);
    return reason;
  });
  if (refusal) {
    await finish(interaction, refusal);
    return;
  }

  try {
    await createTicketChannel(interaction, context, category, form, parent);
  } finally {
    reserved.delete(opener.id);
  }
}

// One open attempt per opener at a time. `reserved` covers the gap between
// passing the checks and the ticket row existing, which is what the next
// attempt's count would otherwise miss.
const queues = new Map<string, Promise<unknown>>();
const reserved = new Set<string>();

async function serialised<T>(userId: string, task: () => Promise<T>): Promise<T | string> {
  if (reserved.has(userId)) return "Your ticket is being opened. Give it a second.";
  const previous = queues.get(userId) ?? Promise.resolve();
  const run = previous.catch(() => {}).then(task);
  queues.set(userId, run);
  try {
    return await run;
  } finally {
    if (queues.get(userId) === run) queues.delete(userId);
  }
}

async function createTicketChannel(
  interaction: OpenInteraction | ModalSubmitInteraction,
  context: OpenContext,
  category: TicketCategory,
  form: TicketFormResult,
  parent: string,
): Promise<void> {
  const { guild, config, member, opener } = context;
  const forSomeoneElse = opener.id !== member.id;
  // Consumed now: the ticket is being made, whatever happens next.
  const pending = takePendingOpen(guild.id, member.id);

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, opener.id);
  const openerUserId = integration?.user_id ?? null;
  const openerProfile = openerUserId ? await getTicketOpenerProfile(supabase, openerUserId) : null;
  const ticketNumber = await nextTicketNumber(supabase, guild.id);

  const channel = await guild.channels.create({
    name: renderChannelName(
      category.channel_name_template,
      {
        "ticket.number": String(ticketNumber).padStart(4, "0"),
        "ticket.category": category.name,
        "member.name": opener.displayName,
      },
      ticketChannelName(ticketNumber),
    ),
    type: ChannelType.GuildText,
    parent,
    rateLimitPerUser: category.slowmode_seconds || undefined,
    permissionOverwrites: computeTicketOverwrites({
      everyoneRoleId: guild.roles.everyone.id,
      botId: guild.client.user.id,
      settings: config.settings,
      category,
      ticket: { opener_discord_user_id: opener.id, claimed_by_discord_user_id: null },
      memberIds: [],
    }),
  });
  // The server log would otherwise report the new channel as a staff action.
  markSelfAction("channel", channel.id);

  // If the ticket row or intro message fails, the channel would be left behind
  // with nothing tracking it — remove it (and close the row, if it got that far)
  // and let the handler report the error. The allocated ticket number is skipped.
  let ticketCreated = false;
  try {
    const ticket = await createTicket(supabase, {
      guildId: guild.id,
      ticketNumber,
      channelId: channel.id,
      openerDiscordUserId: opener.id,
      openerUserId,
      subject: form.subject,
      description: storedDescription(form),
      category: category.slug,
      product: form.product,
      openerName: opener.displayName,
      referencesMessageUrl: pending?.referencesMessageUrl ?? null,
      createdByDiscordUserId: forSomeoneElse ? member.id : null,
    });
    ticketCreated = true;
    // Answers are history for the dashboard; the ticket works without them.
    await insertTicketAnswers(supabase, ticket.id, form.answers).catch((error) =>
      reportError(error, "discord-bot tickets: save answers", { ticketId: ticket.id }),
    );
    // Opened by staff for someone: the timeline names the staff member as actor.
    await recordTicketEvent(guild, ticket, "opened", forSomeoneElse ? member : opener, "discord");
    trackTicketChannel(guild.id, channel.id, {
      ticketId: ticket.id,
      number: ticket.ticket_number,
      channelId: channel.id,
      openerId: ticket.opener_discord_user_id,
      categorySlug: ticket.category,
    });

    const intro = buildTicketIntroMessage(ticket, config, openerProfile, {
      answers: form.answers,
      description: form.description,
      member: opener,
      values: await ticketStatsValues(guild.id),
    });
    const lines = [intro.content];
    if (pending?.referencesMessageUrl) lines.push(`About this message: ${pending.referencesMessageUrl}`);
    if (forSomeoneElse) lines.push(`Opened by ${member} on their behalf.`);
    await channel.send({ ...intro, content: lines.join("\n").slice(0, 2000) });
  } catch (error) {
    if (ticketCreated) {
      // Closed straight in the DB, not through finalizeTicketClose: a ticket
      // that never got its intro message shouldn't reach the log as a close.
      await closeTicket(supabase, channel.id, {
        code: "force",
        reason: "Ticket creation failed",
        closedByDiscordUserId: guild.client.user.id,
        closedByName: guild.client.user.username,
      }).catch(() => {});
      trackTicketChannel(guild.id, channel.id, null);
    }
    await channel.delete("Ticket creation failed").catch(() => {});
    throw error;
  }

  await finish(
    interaction,
    forSomeoneElse ? `✅ Opened <#${channel.id}> for ${opener.displayName}.` : `✅ Your ticket is open: <#${channel.id}>`,
  );
}
