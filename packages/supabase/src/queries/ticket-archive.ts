import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "../types/supabase";
import type { DiscordTicketMessage, DiscordTicketMessageInsert } from "./tickets";

type DBClient = SupabaseClient<Database>;

// The live archive of ticket conversations: one write per message as it
// happens, an update per edit, a stamp per delete. The bot is the only writer;
// web-admin reads through getTicketHistory.

/** What the archive_ticket_message RPC takes: a message row minus ticket_id. */
export type ArchivedMessage = Omit<DiscordTicketMessageInsert, "ticket_id" | "id" | "deleted_at" | "pinned">;

export interface ArchiveOptions {
  /** Whether this message counts as ticket activity (people yes, bots no). */
  counts: boolean;
  byStaff: boolean;
}

/** Writes one message and, for a person's message, the ticket's activity stamps. Idempotent. */
export async function archiveTicketMessage(
  client: DBClient,
  ticketId: string,
  message: ArchivedMessage,
  { counts, byStaff }: ArchiveOptions,
): Promise<void> {
  const { error } = await client.rpc("archive_ticket_message", {
    p_ticket_id: ticketId,
    p_message: message as unknown as Json,
    p_counts: counts,
    p_by_staff: byStaff,
  });
  if (error) throw error;
}

export interface MessageEdit {
  content?: string;
  embeds?: Json;
  editedAt?: string | null;
  pinned?: boolean;
}

/** An edit, a pin or an unfurl: only what changed is written. No-op for messages the archive never saw. */
export async function updateArchivedMessage(client: DBClient, messageId: string, edit: MessageEdit): Promise<void> {
  const patch: Partial<DiscordTicketMessage> = {};
  if (edit.content !== undefined) patch.content = edit.content;
  if (edit.embeds !== undefined) patch.embeds = edit.embeds;
  if (edit.editedAt !== undefined) patch.edited_at = edit.editedAt;
  if (edit.pinned !== undefined) patch.pinned = edit.pinned;
  if (Object.keys(patch).length === 0) return;
  const { error } = await client.from("discord_ticket_messages").update(patch).eq("message_id", messageId);
  if (error) throw error;
}

/** Deleted in Discord: the text stays, the row is flagged. Already-flagged rows keep their first stamp. */
export async function markArchivedMessagesDeleted(client: DBClient, messageIds: string[], at = new Date()): Promise<void> {
  if (messageIds.length === 0) return;
  const { error } = await client
    .from("discord_ticket_messages")
    .update({ deleted_at: at.toISOString() })
    .in("message_id", messageIds)
    .is("deleted_at", null);
  if (error) throw error;
}

/** Which messages of a ticket are already archived, for the reconcile that fills gaps. */
export async function listArchivedMessageIds(client: DBClient, ticketId: string): Promise<Set<string>> {
  const { data, error } = await client.from("discord_ticket_messages").select("message_id").eq("ticket_id", ticketId);
  if (error) throw error;
  return new Set(data.map((row) => row.message_id));
}

/** Inserts messages the archive missed (bot down, gateway hiccup). Rows already there are left alone. */
export async function insertMissingTicketMessages(
  client: DBClient,
  ticketId: string,
  messages: ArchivedMessage[],
): Promise<void> {
  const rows = messages.map((message) => ({ ...message, ticket_id: ticketId }));
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await client
      .from("discord_ticket_messages")
      .upsert(rows.slice(i, i + 500), { onConflict: "message_id", ignoreDuplicates: true });
    if (error) throw error;
  }
}

/** Marks the transcript complete and records its size. Called once the close has reconciled the channel. */
export async function stampTicketTranscript(client: DBClient, ticketId: string): Promise<number> {
  const { count, error } = await client
    .from("discord_ticket_messages")
    .select("id", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if (error) throw error;
  const { error: updateError } = await client
    .from("discord_tickets")
    .update({ transcript_saved_at: new Date().toISOString(), transcript_message_count: count ?? 0 })
    .eq("id", ticketId);
  if (updateError) throw updateError;
  return count ?? 0;
}

/** How many images of a ticket already have an R2 copy, so the per-ticket cap survives a restart. */
export async function countCopiedImages(client: DBClient, ticketId: string): Promise<number> {
  const { data, error } = await client.from("discord_ticket_messages").select("attachments").eq("ticket_id", ticketId);
  if (error) throw error;
  let copied = 0;
  for (const row of data) {
    for (const attachment of (row.attachments as { r2_key?: string | null }[] | null) ?? []) {
      if (attachment.r2_key) copied++;
    }
  }
  return copied;
}

export interface OpenTicketRef {
  ticketId: string;
  number: number;
  channelId: string;
  openerId: string;
  categorySlug: string;
}

/** Every open ticket in a guild, keyed by channel, with what the archive needs to file a message. */
export async function listOpenTicketRefs(client: DBClient, guildId: string): Promise<Map<string, OpenTicketRef>> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("id, ticket_number, channel_id, opener_discord_user_id, category")
    .eq("guild_id", guildId)
    .eq("status", "open");
  if (error) throw error;
  return new Map(
    data.map((row) => [
      row.channel_id,
      {
        ticketId: row.id,
        number: row.ticket_number,
        channelId: row.channel_id,
        openerId: row.opener_discord_user_id,
        categorySlug: row.category,
      },
    ]),
  );
}

/** Text for the transcript file: the ticket's messages in order, deleted ones included and flagged. */
export async function listTicketMessages(client: DBClient, ticketId: string): Promise<DiscordTicketMessage[]> {
  const { data, error } = await client.from("discord_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at");
  if (error) throw error;
  return data;
}
