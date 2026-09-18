import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// What the bot's sweeper reads and claims. Every write here is conditional on
// the column it is about to set still being empty, and returns whether it won:
// two sweeper runs (a restart mid-run, an overlapping tick) can't both warn
// or both act on the same ticket.

/** An open ticket as the sweeper sees it: when it was last alive and what has already been done about it. */
export interface SweepTicketRow {
  id: string;
  ticket_number: number;
  channel_id: string;
  opener_discord_user_id: string;
  category: string;
  created_at: string;
  last_message_at: string | null;
  stale_warned_at: string | null;
}

export async function listOpenTicketsForSweep(client: DBClient, guildId: string): Promise<SweepTicketRow[]> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("id, ticket_number, channel_id, opener_discord_user_id, category, created_at, last_message_at, stale_warned_at")
    .eq("guild_id", guildId)
    .eq("status", "open");
  if (error) throw error;
  return data;
}

/** Claims the stale reminder for a ticket. False when it was already warned (or closed) by another run. */
export async function claimStaleWarning(client: DBClient, ticketId: string, at = new Date()): Promise<boolean> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({ stale_warned_at: at.toISOString() })
    .eq("id", ticketId)
    .eq("status", "open")
    .is("stale_warned_at", null)
    .select("id");
  if (error) throw error;
  return data.length > 0;
}

/** Takes a ticket off the stale list without a message, e.g. when staff act on it from the dashboard. */
export async function clearStaleWarning(client: DBClient, ticketId: string): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ stale_warned_at: null })
    .eq("id", ticketId)
    .eq("status", "open");
  if (error) throw error;
}
