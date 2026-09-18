import type { Message, PartialMessage } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import {
  archiveTicketMessage,
  countCopiedImages,
  markArchivedMessagesDeleted,
  updateArchivedMessage,
} from "@repo/supabase/queries/ticket-archive";
import { insertTicketEvent } from "@repo/supabase/queries/tickets";
import { listRepliedTagNames } from "@repo/supabase/queries/ticket-tags";
import { replaceVariables } from "@repo/discord-message";
import { guildVariableValues, memberVariableValues } from "../built-message";
import { getOpenTicket, type TrackedTicket } from "../ticket-activity";
import { toArchivedMessage } from "../ticket-transcript";
import { findCategory, getTicketConfig } from "./config";
import { isStaff } from "./staff";
import { matchTags } from "./tags";

// The live archive: every message in an open ticket channel is written as it
// happens, edits update it, deletes flag it. The cached open-ticket map is
// checked first, so messages everywhere else in the server cost nothing here.
// Nothing in this file throws: a failed write is reported and the close's
// reconcile fills the gap.

/** Whether the author counts as staff for response metrics. The opener never does, whatever their roles. */
async function wroteAsStaff(message: Message<true>, ticket: TrackedTicket): Promise<boolean> {
  if (message.author.id === ticket.openerId) return false;
  const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
  if (!member) return false;
  const config = await getTicketConfig(message.guildId);
  return isStaff(member, config.settings, findCategory(config, ticket.categorySlug));
}

interface ArchiveOverride {
  counts: boolean;
  byStaff: boolean;
}

/**
 * A new message in a ticket channel. People's messages count as activity and,
 * for staff, as a response; the bot's own never do, unless the caller says so
 * (the dashboard reply is posted by the bot on a person's behalf).
 */
export async function archiveNewMessage(message: Message, override?: ArchiveOverride): Promise<void> {
  if (!message.inGuild() || message.system) return;
  const ticket = await getOpenTicket(message.guildId, message.channelId).catch(() => null);
  if (!ticket) return;

  try {
    // The per-ticket image cap has to survive restarts, so it is counted from the DB the first time it matters.
    if (ticket.imagesCopied === null && message.attachments.size > 0) {
      ticket.imagesCopied = await countCopiedImages(supabase, ticket.ticketId);
    }
    const budget = { imagesCopied: ticket.imagesCopied ?? 0 };
    const row = await toArchivedMessage({ id: ticket.ticketId, guild_id: message.guildId }, message, budget);
    if (ticket.imagesCopied !== null) ticket.imagesCopied = budget.imagesCopied;

    const counts = override?.counts ?? (!message.author.bot && !message.webhookId);
    const byStaff = override?.byStaff ?? (counts && (await wroteAsStaff(message, ticket)));
    await archiveTicketMessage(supabase, ticket.ticketId, row, { counts, byStaff });
    // A member's message may trigger a canned answer. Off the archive's path.
    if (counts && !byStaff) void autoReplyTags(message, ticket);
  } catch (error) {
    reportError(error, "discord-bot tickets: archive message", { ticketId: ticket.ticketId, messageId: message.id });
  }
}

/**
 * Tags with auto-reply whose keywords appear in a member's message post their
 * content once per ticket. Which ones already did is read from the timeline
 * the first time it matters and then kept on the cached ticket.
 */
async function autoReplyTags(message: Message<true>, ticket: TrackedTicket): Promise<void> {
  try {
    const config = await getTicketConfig(message.guildId);
    const matched = matchTags(config.tags, message.content);
    if (matched.length === 0) return;
    ticket.repliedTagNames ??= await listRepliedTagNames(supabase, ticket.ticketId);

    const member = message.member ?? (await message.guild.members.fetch(message.author.id).catch(() => null));
    const values = { ...guildVariableValues(message.guild), ...(member ? memberVariableValues(member) : {}) };
    for (const tag of matched) {
      if (ticket.repliedTagNames.has(tag.name)) continue;
      ticket.repliedTagNames.add(tag.name);
      await message.channel.send({
        content: replaceVariables(tag.content, values).slice(0, 2000),
        allowedMentions: { parse: [], users: [message.author.id] },
      });
      await insertTicketEvent(supabase, {
        ticketId: ticket.ticketId,
        type: "tag_replied",
        actorDiscordId: null,
        actorName: null,
        detail: { tag: tag.name },
      });
    }
  } catch (error) {
    reportError(error, "discord-bot tickets: tag auto-reply", { ticketId: ticket.ticketId, messageId: message.id });
  }
}

/** An edit, pin or unfurl of a message in a ticket channel. Rows the archive never saw are left for the reconcile. */
export async function archiveMessageUpdate(message: Message | PartialMessage): Promise<void> {
  if (!message.guildId) return;
  if (!(await getOpenTicket(message.guildId, message.channelId).catch(() => null))) return;
  const full = message.partial ? await message.fetch().catch(() => null) : message;
  if (!full) return;

  try {
    await updateArchivedMessage(supabase, full.id, {
      content: full.content,
      embeds: full.embeds.map((embed) => embed.toJSON()) as unknown as import("@repo/supabase").Json,
      editedAt: full.editedAt?.toISOString() ?? null,
      pinned: full.pinned,
    });
  } catch (error) {
    reportError(error, "discord-bot tickets: archive edit", { messageId: full.id });
  }
}

/** One or many messages deleted in a ticket channel. The text stays; the rows are flagged. */
export async function archiveMessageDeletes(guildId: string, channelId: string, messageIds: string[]): Promise<void> {
  if (!(await getOpenTicket(guildId, channelId).catch(() => null))) return;
  try {
    await markArchivedMessagesDeleted(supabase, messageIds);
  } catch (error) {
    reportError(error, "discord-bot tickets: archive delete", { channelId, count: messageIds.length });
  }
}
