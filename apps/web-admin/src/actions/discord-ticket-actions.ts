"use server";

import { reportError } from "@repo/sentry";
import { z } from "zod";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getDiscordUserIdForUser } from "@repo/supabase/queries/discord";
import { getTicketByNumber } from "@repo/supabase/queries/tickets";
import { listTicketMembers } from "@repo/supabase/queries/ticket-lifecycle";
import { getUserDisplayProfile } from "@repo/supabase/queries/user";
import { buildTicketSnapshot, toTicketMember, type TicketMember, type TicketSnapshot } from "@/lib/discord/ticket-snapshot";
import { resolveDiscordProfiles } from "@/lib/discord/users";
import { DashboardError, requireDiscordAdmin, toActionError, type DiscordActionResult } from "@/lib/discord/action";
import { callBot } from "@/lib/discord/bot-bridge";

// Claim and close from the ticket page. The bot does the work as the admin's
// linked Discord account, so the ticket, timeline and channel show who did it.

const ticketNumberSchema = z.number().int().positive();

async function prepare(ticketNumber: number) {
  const { userId, guildId } = await requireDiscordAdmin();
  if (!ticketNumberSchema.safeParse(ticketNumber).success) throw new DashboardError("Invalid ticket");

  const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
  if (!discordUserId) throw new DashboardError("Link your Discord account in StreamWizard first. Claims and closes are made as you.");

  const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
  if (!ticket) throw new DashboardError("That ticket doesn't exist");
  if (ticket.status !== "open") throw new DashboardError("This ticket is already closed");
  return { guildId, discordUserId, ticket };
}

// No revalidatePath here on purpose. Any revalidation inside a server action
// makes Next re-render the page the admin is on, and both ticket pages follow
// their rows over Supabase Realtime instead. The bot's write is the signal.
export async function claimTicketFromDashboard(ticketNumber: number): Promise<DiscordActionResult> {
  try {
    const { guildId, discordUserId, ticket } = await prepare(ticketNumber);
    if (ticket.claimed_by_discord_user_id) throw new DashboardError("Someone already claimed this ticket");

    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/claim`, { discordUserId });
    if (!result.ok) throw new DashboardError(result.error);

    return { error: null };
  } catch (error) {
    return toActionError(error, "claim ticket", "Couldn't claim the ticket. Try again?");
  }
}

const closeReasonSchema = z.string().trim().max(1000, "Keep the reason under 1000 characters").nullable();

export async function closeTicketFromDashboard(ticketNumber: number, reason: string | null = null): Promise<DiscordActionResult> {
  try {
    const { guildId, discordUserId, ticket } = await prepare(ticketNumber);
    const parsedReason = closeReasonSchema.safeParse(reason);
    if (!parsedReason.success) throw new DashboardError(parsedReason.error.issues[0]?.message ?? "Invalid reason");

    // Saving the transcript (and copying images) happens before the channel
    // goes, which can take a while on long tickets.
    const result = await callBot(
      guildId,
      `/tickets/${ticket.channel_id}/close`,
      { discordUserId, reason: parsedReason.data || null },
      { timeoutMs: 60_000 },
    );
    if (!result.ok) throw new DashboardError(result.error);

    return { error: null };
  } catch (error) {
    return toActionError(error, "close ticket", "Couldn't close the ticket. Try again?");
  }
}

// Everything else staff can do to an open ticket. The bot runs the same action
// the slash command does, as the admin's linked Discord account; its answer,
// when it says no, is already a sentence for the person who asked.
const snowflake = z.string().regex(/^\d{17,20}$/, "That isn't a Discord id");

const TICKET_CHANGES = {
  release: z.object({}),
  priority: z.object({ priority: z.enum(["low", "medium", "high"]).nullable() }),
  subject: z.object({ subject: z.string().trim().min(1, "The subject can't be empty").max(100) }),
  move: z.object({ category: z.string().regex(/^[a-z0-9_]{1,32}$/) }),
  "members/add": z.object({ targetDiscordUserId: snowflake }),
  "members/remove": z.object({ targetDiscordUserId: snowflake, targetName: z.string().max(100).optional() }),
  transfer: z.object({ targetDiscordUserId: snowflake }),
  // The opener's close request: accepting closes the ticket, rejecting keeps it open.
  "close-accept": z.object({}),
  "close-reject": z.object({}),
} as const;

export type TicketChange = keyof typeof TICKET_CHANGES;

export async function changeTicketFromDashboard<K extends TicketChange>(
  ticketNumber: number,
  change: K,
  input: z.input<(typeof TICKET_CHANGES)[K]>,
): Promise<DiscordActionResult> {
  try {
    const { guildId, discordUserId, ticket } = await prepare(ticketNumber);
    const schema = TICKET_CHANGES[change];
    if (!schema) throw new DashboardError("Unknown ticket action");
    const parsed = schema.safeParse(input);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid input");

    // Moving a channel and rewriting its permissions can take a few round trips
    // to Discord; accepting a close request saves the transcript like a close.
    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/${change}`, { discordUserId, ...parsed.data }, {
      timeoutMs: change === "close-accept" ? 60_000 : 20_000,
    });
    if (!result.ok) throw new DashboardError(result.error);

    return { error: null };
  } catch (error) {
    return toActionError(error, `ticket ${change}`, "Couldn't change the ticket. Try again?");
  }
}

export interface MemberSearchResult {
  id: string;
  name: string;
  username: string;
}

/** Server members whose name starts with `query`, for adding someone to a ticket or handing it over. */
export async function searchGuildMembers(query: string): Promise<MemberSearchResult[]> {
  try {
    const { api } = await requireDiscordAdmin();
    const trimmed = query.trim().slice(0, 32);
    if (!trimmed) return [];

    // A pasted id finds exactly that member, which also works for names Discord's prefix search misses.
    if (snowflake.safeParse(trimmed).success) {
      const member = await api.guilds.getMember(trimmed);
      return member?.user ? [{ id: member.user.id, name: member.nick ?? member.user.global_name ?? member.user.username, username: member.user.username }] : [];
    }

    const members = await api.guilds.searchMembers(trimmed, 10);
    return members.flatMap((member) =>
      member.user && !member.user.bot
        ? [{ id: member.user.id, name: member.nick ?? member.user.global_name ?? member.user.username, username: member.user.username }]
        : [],
    );
  } catch {
    return [];
  }
}

const replySchema = z.string().trim().min(1, "Write something first").max(2000, "Keep it under 2000 characters");

/**
 * Posts a staff reply in the ticket channel. The bot sends it with the
 * sender's name and avatar as credit: their Discord profile when linked,
 * otherwise their StreamWizard name and Twitch avatar.
 */
export async function sendTicketReply(ticketNumber: number, content: string): Promise<DiscordActionResult> {
  try {
    const { userId, guildId } = await requireDiscordAdmin();
    const parsed = replySchema.safeParse(content);
    if (!parsed.success) throw new DashboardError(parsed.error.issues[0]?.message ?? "Invalid message");
    if (!ticketNumberSchema.safeParse(ticketNumber).success) throw new DashboardError("Invalid ticket");

    const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
    if (!ticket || ticket.status !== "open") throw new DashboardError("This ticket isn't open anymore");

    const discordUserId = await getDiscordUserIdForUser(supabaseAdmin, userId);
    const discordProfile = discordUserId ? (await resolveDiscordProfiles([discordUserId])).get(discordUserId) : undefined;
    const fallback = discordProfile ? null : await getUserDisplayProfile(supabaseAdmin, userId);

    const result = await callBot(guildId, `/tickets/${ticket.channel_id}/message`, {
      authorName: discordProfile?.name ?? fallback?.name ?? "StreamWizard staff",
      authorAvatarUrl: discordProfile?.avatarUrl ?? fallback?.avatarUrl ?? null,
      content: parsed.data,
    });
    if (!result.ok) throw new DashboardError(result.error);

    return { error: null };
  } catch (error) {
    return toActionError(error, "ticket reply", "Couldn't send the message. Try again?");
  }
}

// Reads for the ticket page. It renders once from the server and then follows
// the ticket's rows over Supabase Realtime; these fill the gaps: a resync after
// the socket dropped, the manual refresh button, members after a
// member_added/member_removed event, and names for people a new message
// mentions.

async function loadTicket(ticketNumber: number) {
  const { guildId } = await requireDiscordAdmin();
  if (!ticketNumberSchema.safeParse(ticketNumber).success) throw new DashboardError("Invalid ticket");
  const ticket = await getTicketByNumber(supabaseAdmin, guildId, ticketNumber);
  if (!ticket) throw new DashboardError("That ticket doesn't exist");
  return ticket;
}

function readError(error: unknown, context: string, fallback: string): { error: string } {
  return { error: toActionError(error, context, fallback).error ?? fallback };
}

export async function getTicketSnapshot(
  ticketNumber: number,
): Promise<({ error: null } & TicketSnapshot) | { error: string }> {
  try {
    const ticket = await loadTicket(ticketNumber);
    return { error: null, ...(await buildTicketSnapshot(ticket)) };
  } catch (error) {
    return readError(error, "ticket snapshot", "Couldn't load the ticket.");
  }
}

export async function listTicketMembersForDashboard(
  ticketNumber: number,
): Promise<{ error: null; members: TicketMember[] } | { error: string }> {
  try {
    const ticket = await loadTicket(ticketNumber);
    const members = await listTicketMembers(supabaseAdmin, ticket.id);
    return { error: null, members: members.map(toTicketMember) };
  } catch (error) {
    return readError(error, "ticket members", "Couldn't load the ticket's members.");
  }
}

const SNOWFLAKE = /^\d{17,20}$/;

/** Display names for Discord user ids a new message or event mentions. Cached server side. */
export async function lookupDiscordNames(ids: string[]): Promise<Record<string, string>> {
  try {
    await requireDiscordAdmin();
    const wanted = [...new Set(ids.filter((id) => SNOWFLAKE.test(id)))].slice(0, 25);
    const profiles = await resolveDiscordProfiles(wanted);
    return Object.fromEntries([...profiles].map(([id, profile]) => [id, profile.name]));
  } catch (error) {
    reportError(error, "web-admin discord: mention names");
    return {};
  }
}
