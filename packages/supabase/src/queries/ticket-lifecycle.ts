import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";
import type { DiscordTicket } from "./tickets";

type DBClient = SupabaseClient<Database>;

// What happens to a ticket between open and close: who may open one, and the
// staff actions on an open ticket. Every update is guarded by status = 'open'
// and returns the row, or null when the ticket was closed (or changed) first,
// so two staff acting at once can't overwrite each other.

export type TicketMember = Database["public"]["Tables"]["discord_ticket_members"]["Row"];

export const TICKET_PRIORITIES = ["low", "medium", "high"] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export const isTicketPriority = (value: string): value is TicketPriority =>
  (TICKET_PRIORITIES as readonly string[]).includes(value);

/** What the gating checks need about a member: their open tickets, and when they last opened one per category. */
export interface OpenerTicketStats {
  openTotal: number;
  openByCategory: Map<string, number>;
  /** ISO time of their newest ticket per category, open or closed. */
  lastOpenedByCategory: Map<string, string>;
}

export async function getOpenerTicketStats(
  client: DBClient,
  guildId: string,
  openerDiscordUserId: string,
): Promise<OpenerTicketStats> {
  // Newest 100 is plenty: limits top out at 50 open, and a cooldown only looks at the newest per category.
  const { data, error } = await client
    .from("discord_tickets")
    .select("category, status, created_at")
    .eq("guild_id", guildId)
    .eq("opener_discord_user_id", openerDiscordUserId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const stats: OpenerTicketStats = { openTotal: 0, openByCategory: new Map(), lastOpenedByCategory: new Map() };
  for (const ticket of data) {
    if (!stats.lastOpenedByCategory.has(ticket.category)) stats.lastOpenedByCategory.set(ticket.category, ticket.created_at);
    if (ticket.status !== "open") continue;
    stats.openTotal += 1;
    stats.openByCategory.set(ticket.category, (stats.openByCategory.get(ticket.category) ?? 0) + 1);
  }
  return stats;
}

export async function countOpenTicketsInCategory(client: DBClient, guildId: string, category: string): Promise<number> {
  const { count, error } = await client
    .from("discord_tickets")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("category", category)
    .eq("status", "open");
  if (error) throw error;
  return count ?? 0;
}

/** Open tickets a member opened. For closing them when the member leaves. */
export async function listOpenTicketsByOpener(
  client: DBClient,
  guildId: string,
  openerDiscordUserId: string,
): Promise<DiscordTicket[]> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("opener_discord_user_id", openerDiscordUserId)
    .eq("status", "open");
  if (error) throw error;
  return data;
}

/** A member's tickets, newest first: all the open ones and the latest closed ones. For `/ticket list`. */
export async function listTicketsForOpener(
  client: DBClient,
  guildId: string,
  openerDiscordUserId: string,
  limit = 15,
): Promise<DiscordTicket[]> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("opener_discord_user_id", openerDiscordUserId)
    .order("status", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

type OpenTicketPatch = Database["public"]["Tables"]["discord_tickets"]["Update"];

async function updateOpenTicket(client: DBClient, channelId: string, patch: OpenTicketPatch): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update(patch)
    .eq("channel_id", channelId)
    .eq("status", "open")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Releases a claim. Null when the ticket isn't claimed (someone released it first) or isn't open. */
export async function unclaimTicket(client: DBClient, channelId: string): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ claimed_by_discord_user_id: null, claimed_by_name: null, claimed_at: null })
    .eq("channel_id", channelId)
    .eq("status", "open")
    .not("claimed_by_discord_user_id", "is", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export const setTicketPriority = (client: DBClient, channelId: string, priority: TicketPriority | null) =>
  updateOpenTicket(client, channelId, { priority });

export const setTicketSubject = (client: DBClient, channelId: string, subject: string) =>
  updateOpenTicket(client, channelId, { subject });

export const setTicketCategory = (client: DBClient, channelId: string, category: string) =>
  updateOpenTicket(client, channelId, { category });

/** Hands the ticket to another member: they become its opener. `openerUserId` is their linked StreamWizard account, if any. */
export const setTicketOpener = (
  client: DBClient,
  channelId: string,
  opener: { discordUserId: string; name: string; userId: string | null },
) =>
  updateOpenTicket(client, channelId, {
    opener_discord_user_id: opener.discordUserId,
    opener_name: opener.name,
    opener_user_id: opener.userId,
  });

export async function listTicketMembers(client: DBClient, ticketId: string): Promise<TicketMember[]> {
  const { data, error } = await client
    .from("discord_ticket_members")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("added_at", { ascending: true });
  if (error) throw error;
  return data;
}

/** False when they were already in the ticket. */
export async function addTicketMember(
  client: DBClient,
  member: { ticketId: string; discordUserId: string; name: string; addedByDiscordUserId: string | null },
): Promise<boolean> {
  const { data, error } = await client
    .from("discord_ticket_members")
    .upsert(
      {
        ticket_id: member.ticketId,
        discord_user_id: member.discordUserId,
        name: member.name,
        added_by_discord_user_id: member.addedByDiscordUserId,
      },
      { onConflict: "ticket_id,discord_user_id", ignoreDuplicates: true },
    )
    .select("discord_user_id");
  if (error) throw error;
  return data.length > 0;
}

/** False when they weren't in the ticket. */
export async function removeTicketMember(client: DBClient, ticketId: string, discordUserId: string): Promise<boolean> {
  const { data, error } = await client
    .from("discord_ticket_members")
    .delete()
    .eq("ticket_id", ticketId)
    .eq("discord_user_id", discordUserId)
    .select("discord_user_id");
  if (error) throw error;
  return data.length > 0;
}

// Close requests (close_mode = request). One pending request per ticket; the
// claim is the IS NULL guard, so two people asking at once produce one
// request, and a reject racing an expiry clears it once.

/** Opens a close request. Null when one is already pending, or the ticket isn't open. */
export async function requestTicketClose(
  client: DBClient,
  channelId: string,
  input: { requestedByDiscordUserId: string; expiresAt: Date },
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({
      close_requested_at: new Date().toISOString(),
      close_requested_by: input.requestedByDiscordUserId,
      close_request_expires_at: input.expiresAt.toISOString(),
    })
    .eq("channel_id", channelId)
    .eq("status", "open")
    .is("close_requested_at", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Clears the pending request (rejected, expired, or accepted and closed). Null when there was none. */
export async function clearTicketCloseRequest(client: DBClient, ticketId: string): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ close_requested_at: null, close_requested_by: null, close_request_expires_at: null })
    .eq("id", ticketId)
    .eq("status", "open")
    .not("close_requested_at", "is", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Feedback from the closing DM. One rating per ticket, from the opener only:
// the IS NULL guard makes a second click a no-op instead of an overwrite.

export const TICKET_FEEDBACK_COMMENT_MAX = 1000;

/** Stores the opener's rating. Null when the ticket is already rated, or isn't theirs. */
export async function rateTicket(
  client: DBClient,
  ticketId: string,
  openerDiscordUserId: string,
  rating: number,
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ feedback_rating: rating, feedback_at: new Date().toISOString() })
    .eq("id", ticketId)
    .eq("opener_discord_user_id", openerDiscordUserId)
    .is("feedback_rating", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Adds the optional comment to a rating already given. Null when there is no rating to attach it to. */
export async function commentTicketFeedback(
  client: DBClient,
  ticketId: string,
  openerDiscordUserId: string,
  comment: string,
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ feedback_comment: comment.trim().slice(0, TICKET_FEEDBACK_COMMENT_MAX) || null })
    .eq("id", ticketId)
    .eq("opener_discord_user_id", openerDiscordUserId)
    .not("feedback_rating", "is", null)
    .is("feedback_comment", null)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
