import { supabase } from "@repo/supabase";
import { listOpenTicketRefs, type OpenTicketRef } from "@repo/supabase/queries/ticket-archive";
import { TtlCache } from "@repo/ttl-cache";

// Two things every message in a guild needs answered cheaply: is this channel
// an open ticket, and if so which one. The archive files the message under it
// and the server log skips it. One cached map per guild answers both without a
// query; the ticket flows keep it current so nothing waits for the TTL.
//
// web-admin follows tickets through Supabase Realtime on the rows the bot
// writes, so nothing here tells it about changes.

const OPEN_TICKETS_TTL_MS = 60 * 1000;

/** An open ticket as the archive sees it, plus how many images already have an R2 copy (null = not counted yet). */
export interface TrackedTicket extends OpenTicketRef {
  imagesCopied: number | null;
  /** Tags that already auto-replied in this ticket (null = not read from the timeline yet). */
  repliedTagNames: Set<string> | null;
}

/** Open tickets per guild, keyed by channel id. */
const openTickets = new TtlCache<Map<string, TrackedTicket>>({ ttlMs: OPEN_TICKETS_TTL_MS });

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
