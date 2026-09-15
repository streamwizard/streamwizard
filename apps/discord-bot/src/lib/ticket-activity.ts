import type { DiscordTicketActivityPayload } from "@repo/types";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "./env";

// Tells open web-admin ticket pages that something changed so they refetch.
// Goes to every admin's ws-server room; carries no message content (the page
// reads that from Discord itself, behind the admin gate).

const ADMINS_TTL_MS = 5 * 60 * 1000;
const OPEN_TICKETS_TTL_MS = 60 * 1000;

let admins: { ids: string[]; fetchedAt: number } | null = null;
const openTickets = new Map<string, { byChannel: Map<string, number>; fetchedAt: number }>();

async function getAdminUserIds(): Promise<string[]> {
  if (admins && Date.now() - admins.fetchedAt < ADMINS_TTL_MS) return admins.ids;
  const { data, error } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  if (error) throw error;
  admins = { ids: [...new Set(data.map((row) => row.user_id))], fetchedAt: Date.now() };
  return admins.ids;
}

async function getOpenTickets(guildId: string): Promise<Map<string, number>> {
  const cached = openTickets.get(guildId);
  if (cached && Date.now() - cached.fetchedAt < OPEN_TICKETS_TTL_MS) return cached.byChannel;
  const { data, error } = await supabase
    .from("discord_tickets")
    .select("channel_id, ticket_number")
    .eq("guild_id", guildId)
    .eq("status", "open");
  if (error) throw error;
  const byChannel = new Map(data.map((row) => [row.channel_id, row.ticket_number]));
  openTickets.set(guildId, { byChannel, fetchedAt: Date.now() });
  return byChannel;
}

/** Whether a channel is an open ticket. The server log skips those: the transcript covers them. */
export async function isOpenTicketChannel(guildId: string, channelId: string): Promise<boolean> {
  return (await getOpenTickets(guildId)).has(channelId);
}

/** Keeps the open-ticket cache right without waiting for the TTL. */
export function trackTicketChannel(guildId: string, channelId: string, ticketNumber: number | null): void {
  const cached = openTickets.get(guildId);
  if (!cached) return;
  if (ticketNumber === null) cached.byChannel.delete(channelId);
  else cached.byChannel.set(channelId, ticketNumber);
}

/**
 * Fire-and-forget: never throws, never blocks the ticket action. For
 * "message" the ticket number is looked up from the channel, and channels
 * that aren't open tickets are ignored.
 */
export async function notifyTicketActivity(
  guildId: string,
  channelId: string,
  kind: DiscordTicketActivityPayload["kind"],
  ticketNumber?: number,
): Promise<void> {
  if (!env.WS_SERVER_URL || !env.CONSUMER_SECRET) return;
  try {
    const number = ticketNumber ?? (await getOpenTickets(guildId)).get(channelId);
    if (number === undefined) return;

    const payload: DiscordTicketActivityPayload = { ticketNumber: number, channelId, kind };
    const config = { wsServerUrl: env.WS_SERVER_URL, consumerSecret: env.CONSUMER_SECRET };
    const results = await Promise.all(
      (await getAdminUserIds()).map((userId) => broadcastToUser(userId, "streamwizard.discord_ticket_activity", payload, config)),
    );
    const failed = results.find((result) => !result.ok && result.reason === "network");
    if (failed && !failed.ok && failed.reason === "network") throw failed.error;
  } catch (error) {
    reportError(error, "discord-bot ticket-activity", { channelId, kind });
  }
}
