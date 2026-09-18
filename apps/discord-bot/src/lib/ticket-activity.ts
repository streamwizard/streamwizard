import type { DiscordTicketActivityPayload } from "@repo/types";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { getAdminUserIds as queryAdminUserIds } from "@repo/supabase/queries/obs-nodes";
import { listOpenTicketRefs, type OpenTicketRef } from "@repo/supabase/queries/ticket-archive";
import { TtlCache } from "@repo/ttl-cache";
import { broadcastToUser } from "@repo/ws-client";
import { env } from "./env";

// Two things every message in a guild needs answered cheaply: is this channel
// an open ticket, and if so which one. The archive files the message under it
// and the server log skips it. One cached map per guild answers both without a
// query; the ticket flows keep it current so nothing waits for the TTL.
//
// Also tells open web-admin ticket pages that something changed so they
// refetch. Goes to every admin's ws-server room; carries no message content.

const ADMINS_TTL_MS = 5 * 60 * 1000;
const OPEN_TICKETS_TTL_MS = 60 * 1000;

/** An open ticket as the archive sees it, plus how many images already have an R2 copy (null = not counted yet). */
export interface TrackedTicket extends OpenTicketRef {
  imagesCopied: number | null;
  /** Tags that already auto-replied in this ticket (null = not read from the timeline yet). */
  repliedTagNames: Set<string> | null;
}

const admins = new TtlCache<string[]>({ ttlMs: ADMINS_TTL_MS });
/** Open tickets per guild, keyed by channel id. */
const openTickets = new TtlCache<Map<string, TrackedTicket>>({ ttlMs: OPEN_TICKETS_TTL_MS });

async function getAdminUserIds(): Promise<string[]> {
  const ids = await admins.fetch("all", () => queryAdminUserIds(supabase));
  return ids ?? [];
}

async function getOpenTickets(guildId: string): Promise<Map<string, TrackedTicket>> {
  const byChannel = await openTickets.fetch(guildId, async () => {
    const refs = await listOpenTicketRefs(supabase, guildId);
    return new Map([...refs].map(([channelId, ref]) => [channelId, { ...ref, imagesCopied: null, repliedTagNames: null }]));
  });
  return byChannel ?? new Map();
}

/** The open ticket in a channel, or null. */
export async function getOpenTicket(guildId: string, channelId: string): Promise<TrackedTicket | null> {
  return (await getOpenTickets(guildId)).get(channelId) ?? null;
}

/** Whether a channel is an open ticket. The server log skips those: the transcript covers them. */
export async function isOpenTicketChannel(guildId: string, channelId: string): Promise<boolean> {
  return (await getOpenTickets(guildId)).has(channelId);
}

/** Keeps the open-ticket cache right without waiting for the TTL. Null removes the channel. */
export function trackTicketChannel(guildId: string, channelId: string, ticket: OpenTicketRef | null): void {
  const cached = openTickets.get(guildId);
  if (!cached) return;
  if (ticket === null) cached.delete(channelId);
  else {
    const previous = cached.get(channelId);
    cached.set(channelId, { ...ticket, imagesCopied: previous?.imagesCopied ?? null, repliedTagNames: previous?.repliedTagNames ?? null });
  }
}

/** After a move or transfer, the next lookup reloads the guild's tickets. */
export function forgetOpenTickets(guildId: string): void {
  openTickets.delete(guildId);
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
    const number = ticketNumber ?? (await getOpenTickets(guildId)).get(channelId)?.number;
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
