import { ChannelType, DiscordAPIError, PermissionFlagsBits } from "discord.js";
import type { GuildMember, TextChannel } from "discord.js";
import { supabase } from "@repo/supabase";
import { getDiscordIntegrationByDiscordUserId } from "@repo/supabase/queries/discord";
import { isActiveCategory, type TicketCategory } from "@repo/supabase/queries/ticket-config";
import {
  addTicketMember,
  listTicketMembers,
  removeTicketMember,
  setTicketCategory,
  setTicketOpener,
  setTicketPriority,
  setTicketSubject,
  unclaimTicket,
  type TicketPriority,
} from "@repo/supabase/queries/ticket-lifecycle";
import { getTicketByChannelId, type DiscordTicket } from "@repo/supabase/queries/tickets";
import type { TicketEventSource } from "@repo/types";
import { reportError } from "@repo/sentry";
import { forgetOpenTickets } from "../ticket-activity";
import { computeTicketOverwrites } from "./access";
import { findCategory, getTicketConfig, type TicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { findIntroMessage, withTicketState } from "./intro";

// What staff can do to an open ticket besides claiming and closing it. Every
// action is the same shape whether it came from a slash command, a button or
// the dashboard: the race-safe DB write, the channel brought in line, a line in
// the channel, the timeline + log event. Callers check who is allowed; nothing
// here does.

export type TicketActionResult = { ok: true; ticket: DiscordTicket } | { ok: false; message: string };

const NOT_A_TICKET = "This channel isn't an open ticket.";
const fail = (message: string): TicketActionResult => ({ ok: false, message });

export interface TicketContext {
  ticket: DiscordTicket;
  config: TicketConfig;
  category: TicketCategory | null;
}

/** The open ticket behind a channel, with the config its category lives in. Null when it isn't one. */
export async function loadTicketContext(channel: TextChannel): Promise<TicketContext | null> {
  const ticket = await getTicketByChannelId(supabase, channel.id);
  if (!ticket || ticket.status !== "open") return null;
  const config = await getTicketConfig(channel.guild.id);
  return { ticket, config, category: findCategory(config, ticket.category) ?? null };
}

/** Rewrites the channel's permissions from the ticket row, its members and its category's staff. */
export async function applyTicketOverwrites(channel: TextChannel, ticket: DiscordTicket, config: TicketConfig): Promise<void> {
  const members = await listTicketMembers(supabase, ticket.id);
  await channel.permissionOverwrites.set(
    computeTicketOverwrites({
      everyoneRoleId: channel.guild.roles.everyone.id,
      botId: channel.client.user.id,
      settings: config.settings,
      category: findCategory(config, ticket.category) ?? null,
      ticket,
      memberIds: members.map((member) => member.discord_user_id),
    }),
    "Ticket permissions",
  );
}

/** The bot can't change who sees a channel without Manage Roles there. Says so instead of a bare Discord error. */
function canEditPermissions(channel: TextChannel): boolean {
  return channel.guild.members.me?.permissionsIn(channel).has(PermissionFlagsBits.ManageRoles) ?? false;
}
const NEEDS_MANAGE_ROLES = "The bot needs the Manage Roles permission to change who can see a ticket.";

/** The card at the top of the channel shows subject, category, priority and claimer: keep it true. */
async function refreshIntro(channel: TextChannel, ticket: DiscordTicket, config: TicketConfig): Promise<void> {
  const intro = await findIntroMessage(channel);
  if (!intro) return;
  await intro
    .edit(withTicketState(intro, ticket, config))
    .catch((error) => reportError(error, "discord-bot tickets: update intro", { ticketId: ticket.id }));
}

const say = (channel: TextChannel, content: string, pingUserId?: string) =>
  channel.send({ content, allowedMentions: { parse: [], users: pingUserId ? [pingUserId] : [] } }).catch(() => {});

// Also drops the guild's open-ticket cache: a move or transfer changes what the archive files a message under.
const nudgeDashboard = (channel: TextChannel, ticket: DiscordTicket) => {
  forgetOpenTickets(channel.guild.id);
};

export async function releaseTicket(
  channel: TextChannel,
  actor: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const released = await unclaimTicket(supabase, channel.id);
  if (!released) return fail("This ticket isn't claimed.");
  const config = await getTicketConfig(channel.guild.id);

  // A hidden claim took the staff roles off the channel; releasing brings them back.
  if (config.settings?.claim_hides_from_other_staff && canEditPermissions(channel)) {
    await applyTicketOverwrites(channel, released, config);
  }
  await refreshIntro(channel, released, config);
  await say(channel, `🙌 ${actor} released this ticket. Anyone on staff can claim it.`);
  await recordTicketEvent(channel.guild, released, "unclaimed", actor, source);
  nudgeDashboard(channel, released);
  return { ok: true, ticket: released };
}

export async function changePriority(
  channel: TextChannel,
  actor: GuildMember,
  priority: TicketPriority | null,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const before = await getTicketByChannelId(supabase, channel.id);
  if (!before || before.status !== "open") return fail(NOT_A_TICKET);
  if (before.priority === priority) return { ok: true, ticket: before };

  const updated = await setTicketPriority(supabase, channel.id, priority);
  if (!updated) return fail(NOT_A_TICKET);
  await refreshIntro(channel, updated, await getTicketConfig(channel.guild.id));
  await say(channel, priority ? `🚦 ${actor} set the priority to **${priority}**.` : `🚦 ${actor} cleared the priority.`);
  await recordTicketEvent(channel.guild, updated, "priority_changed", actor, source, {
    detail: { from: before.priority, to: priority },
  });
  nudgeDashboard(channel, updated);
  return { ok: true, ticket: updated };
}

export async function changeSubject(
  channel: TextChannel,
  actor: GuildMember,
  subject: string,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const next = subject.trim().slice(0, 100);
  if (!next) return fail("The subject can't be empty.");
  const before = await getTicketByChannelId(supabase, channel.id);
  if (!before || before.status !== "open") return fail(NOT_A_TICKET);

  const updated = await setTicketSubject(supabase, channel.id, next);
  if (!updated) return fail(NOT_A_TICKET);
  await refreshIntro(channel, updated, await getTicketConfig(channel.guild.id));
  await say(channel, `✏️ ${actor} changed the subject to **${next.replace(/\*/g, "")}**.`);
  await recordTicketEvent(channel.guild, updated, "renamed", actor, source, { detail: { from: before.subject, to: next } });
  nudgeDashboard(channel, updated);
  return { ok: true, ticket: updated };
}

export async function addMember(
  channel: TextChannel,
  actor: GuildMember,
  target: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config } = context;
  if (target.user.bot) return fail("Bots can't be added to a ticket.");
  if (target.id === ticket.opener_discord_user_id) return fail("They opened this ticket, so they're already in it.");
  if (!canEditPermissions(channel)) return fail(NEEDS_MANAGE_ROLES);

  const added = await addTicketMember(supabase, {
    ticketId: ticket.id,
    discordUserId: target.id,
    name: target.displayName,
    addedByDiscordUserId: actor.id,
  });
  if (!added) return fail(`${target.displayName} is already in this ticket.`);

  await applyTicketOverwrites(channel, ticket, config);
  await say(channel, `➕ ${actor} added ${target} to this ticket.`, target.id);
  await recordTicketEvent(channel.guild, ticket, "member_added", actor, source, {
    targetDiscordId: target.id,
    targetName: target.displayName,
  });
  nudgeDashboard(channel, ticket);
  return { ok: true, ticket };
}

export async function removeMember(
  channel: TextChannel,
  actor: GuildMember,
  target: { id: string; displayName: string },
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config } = context;
  if (target.id === ticket.opener_discord_user_id) return fail("The opener can't be removed from their own ticket.");
  if (!canEditPermissions(channel)) return fail(NEEDS_MANAGE_ROLES);

  if (!(await removeTicketMember(supabase, ticket.id, target.id))) return fail(`${target.displayName} wasn't added to this ticket.`);

  await applyTicketOverwrites(channel, ticket, config);
  await say(channel, `➖ ${actor} removed **${target.displayName.replace(/\*/g, "")}** from this ticket.`);
  await recordTicketEvent(channel.guild, ticket, "member_removed", actor, source, {
    targetDiscordId: target.id,
    targetName: target.displayName,
  });
  nudgeDashboard(channel, ticket);
  return { ok: true, ticket };
}

const DISCORD_CATEGORY_CHANNELS = 50;

export async function moveTicket(
  channel: TextChannel,
  actor: GuildMember,
  categorySlug: string,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config } = context;
  const target = config.categories.find((c) => c.slug === categorySlug && isActiveCategory(c));
  if (!target) return fail("That category doesn't exist, or isn't open for tickets.");
  if (target.slug === ticket.category) return fail(`This ticket is already in ${target.name}.`);
  if (!canEditPermissions(channel)) return fail(NEEDS_MANAGE_ROLES);

  // Only moves the channel when the new category keeps its tickets somewhere else.
  const parentId = target.discord_category_id ?? config.settings?.category_id ?? null;
  if (parentId && parentId !== channel.parentId) {
    const parent = await channel.guild.channels.fetch(parentId).catch(() => null);
    if (parent?.type !== ChannelType.GuildCategory) return fail(`${target.name} has no Discord category to move the channel to.`);
    if (parent.children.cache.size >= DISCORD_CATEGORY_CHANNELS) return fail(`${target.name} is full: a Discord category holds 50 channels.`);
  }

  const moved = await setTicketCategory(supabase, channel.id, target.slug);
  if (!moved) return fail(NOT_A_TICKET);

  // lockPermissions false: the ticket's own overwrites are set right after, from the new category's staff.
  if (parentId && parentId !== channel.parentId) await channel.setParent(parentId, { lockPermissions: false });
  await applyTicketOverwrites(channel, moved, config);
  await refreshIntro(channel, moved, config);
  await say(channel, `📂 ${actor} moved this ticket to **${target.name}**.`);
  await recordTicketEvent(channel.guild, moved, "moved", actor, source, {
    detail: { from: context.category?.name ?? ticket.category, to: target.name },
  });
  nudgeDashboard(channel, moved);
  return { ok: true, ticket: moved };
}

export async function transferTicket(
  channel: TextChannel,
  actor: GuildMember,
  target: GuildMember,
  source: TicketEventSource = "discord",
): Promise<TicketActionResult> {
  const context = await loadTicketContext(channel);
  if (!context) return fail(NOT_A_TICKET);
  const { ticket, config } = context;
  if (target.user.bot) return fail("A ticket can't be handed to a bot.");
  if (target.id === ticket.opener_discord_user_id) return fail("They already own this ticket.");
  if (!canEditPermissions(channel)) return fail(NEEDS_MANAGE_ROLES);

  const { data: integration } = await getDiscordIntegrationByDiscordUserId(supabase, target.id);
  const transferred = await setTicketOpener(supabase, channel.id, {
    discordUserId: target.id,
    name: target.displayName,
    userId: integration?.user_id ?? null,
  });
  if (!transferred) return fail(NOT_A_TICKET);

  // The previous owner stays in the conversation as an added member; the new one no longer needs that row.
  await removeTicketMember(supabase, ticket.id, target.id);
  if (ticket.opener_discord_user_id !== "deleted") {
    await addTicketMember(supabase, {
      ticketId: ticket.id,
      discordUserId: ticket.opener_discord_user_id,
      name: ticket.opener_name ?? "Previous owner",
      addedByDiscordUserId: actor.id,
    });
  }

  await applyTicketOverwrites(channel, transferred, config);
  await say(channel, `🤝 ${actor} handed this ticket to ${target}.`, target.id);
  await recordTicketEvent(channel.guild, transferred, "transferred", actor, source, {
    targetDiscordId: target.id,
    targetName: target.displayName,
  });
  nudgeDashboard(channel, transferred);
  return { ok: true, ticket: transferred };
}

/** Discord's own message for a failed permission or channel edit, shortened for an ephemeral reply. */
export function describeDiscordError(error: unknown): string | null {
  if (!(error instanceof DiscordAPIError)) return null;
  if (error.code === 50013) return "The bot is missing a permission for that. Check its role in the server settings.";
  if (error.status === 429) return "Discord is rate limiting that change. Try again in a few minutes.";
  return null;
}
