import type { DiscordTicketActivityPayload } from "@repo/types";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getAdminUserIds as queryAdminUserIds } from "@repo/supabase/queries/obs-nodes";
import { listOpenTicketChannels } from "@repo/supabase/queries/tickets";
import { TtlCache } from "@repo/ttl-cache";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "./env";

// Tells open web-admin ticket pages that something changed so they refetch.
// Goes to every admin's ws-server room; carries no message content (the page
// reads that from Discord itself, behind the admin gate).

const ADMINS_TTL_MS = 5 * 60 * 1000;
const OPEN_TICKETS_TTL_MS = 60 * 1000;

const admins = new TtlCache<string[]>({ ttlMs: ADMINS_TTL_MS });
/** Open tickets per guild, channel id → ticket number. */
const openTickets = new TtlCache<Map<string, number>>({ ttlMs: OPEN_TICKETS_TTL_MS });

async function getAdminUserIds(): Promise<string[]> {
  const ids = await admins.fetch("all", () => queryAdminUserIds(supabase));
  return ids ?? [];
}

async function getOpenTickets(guildId: string): Promise<Map<string, number>> {
  const byChannel = await openTickets.fetch(guildId, () => listOpenTicketChannels(supabase, guildId));
  return byChannel ?? new Map();
}

/** Whether a channel is an open ticket. The server log skips those: the transcript covers them. */
export async function isOpenTicketChannel(guildId: string, channelId: string): Promise<boolean> {
  return (await getOpenTickets(guildId)).has(channelId);
}

/** Keeps the open-ticket cache right without waiting for the TTL. */
export function trackTicketChannel(guildId: string, channelId: string, ticketNumber: number | null): void {
  const cached = openTickets.get(guildId);
  if (!cached) return;
  if (ticketNumber === null) cached.delete(channelId);
  else cached.set(channelId, ticketNumber);
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
      (await getAdminUserIds()).map((userId) =>
        broadcastToUser(userId, "streamwizard.discord_ticket_activity", payload, config),
      ),
    );
    const failed = results.find((result) => !result.ok && result.reason === "network");
    if (failed && !failed.ok && failed.reason === "network") throw failed.error;
  } catch (error) {
    reportError(error, "discord-bot ticket-activity", { channelId, kind });
  }
}
