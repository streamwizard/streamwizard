import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

export type DiscordTicketSettings = Database["public"]["Tables"]["discord_ticket_settings"]["Row"];
export type DiscordTicket = Database["public"]["Tables"]["discord_tickets"]["Row"];
export type DiscordTicketCategory = Database["public"]["Enums"]["discord_ticket_category"];

// Products a ticket can be about, shown in the Discord ticket modal and the
// dashboard. Stored as text, so entries can be added here without a
// migration; keep existing values stable.
export const TICKET_PRODUCTS = [
  { value: "cloud_obs", label: "Cloud OBS", emoji: "☁️", description: "Your OBS in the cloud and the deck" },
  { value: "overlays", label: "Overlays & widgets", emoji: "🎨", description: "Overlay editor, widgets and alerts" },
  { value: "clips", label: "Clip management", emoji: "🎬", description: "Clip folders, syncing and search" },
  { value: "vods", label: "VODs", emoji: "📼", description: "Past broadcasts and markers" },
  { value: "analytics", label: "Analytics", emoji: "📊", description: "Stream stats and viewer numbers" },
  { value: "discord_bot", label: "Discord bot", emoji: "🤖", description: "This bot and its commands" },
  { value: "account", label: "Account & billing", emoji: "👤", description: "Login, linking and subscriptions" },
  { value: "other", label: "Something else", emoji: "❔", description: "Not sure, or none of the above" },
] as const;

export type TicketProduct = (typeof TICKET_PRODUCTS)[number]["value"];

/** "#0012": the ticket number as shown everywhere. */
export function formatTicketNumber(ticketNumber: number): string {
  return `#${String(ticketNumber).padStart(4, "0")}`;
}

/** "ticket-0012": the ticket's Discord channel name. */
export function ticketChannelName(ticketNumber: number): string {
  return `ticket-${String(ticketNumber).padStart(4, "0")}`;
}

export function ticketProductLabel(value: string | null | undefined): string | null {
  if (!value) return null;
  return TICKET_PRODUCTS.find((p) => p.value === value)?.label ?? value;
}

export async function getTicketSettings(client: DBClient, guildId: string): Promise<DiscordTicketSettings | null> {
  const { data, error } = await client
    .from("discord_ticket_settings")
    .select("*")
    .eq("guild_id", guildId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

type TicketSettingsPatch = Partial<Omit<Database["public"]["Tables"]["discord_ticket_settings"]["Insert"], "guild_id">>;

export async function upsertTicketSettings(
  client: DBClient,
  guildId: string,
  patch: TicketSettingsPatch,
): Promise<DiscordTicketSettings> {
  const { data, error } = await client
    .from("discord_ticket_settings")
    .upsert({ guild_id: guildId, ...patch }, { onConflict: "guild_id" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function countOpenTickets(client: DBClient, guildId: string): Promise<number> {
  const { count, error } = await client
    .from("discord_tickets")
    .select("id", { count: "exact", head: true })
    .eq("guild_id", guildId)
    .eq("status", "open");

  if (error) throw error;
  return count ?? 0;
}

// Atomically allocates the next per-guild ticket number (creates the settings
// row on first use). See the next_ticket_number migration.
export async function nextTicketNumber(client: DBClient, guildId: string): Promise<number> {
  const { data, error } = await client.rpc("next_ticket_number", { p_guild_id: guildId });

  if (error) throw error;
  return data;
}

interface CreateTicketInput {
  guildId: string;
  ticketNumber: number;
  channelId: string;
  openerDiscordUserId: string;
  openerUserId: string | null;
  subject: string;
  description: string;
  category: DiscordTicketCategory;
  product: TicketProduct;
  openerName: string;
}

export async function createTicket(client: DBClient, input: CreateTicketInput): Promise<DiscordTicket> {
  const { data, error } = await client
    .from("discord_tickets")
    .insert({
      guild_id: input.guildId,
      ticket_number: input.ticketNumber,
      channel_id: input.channelId,
      opener_discord_user_id: input.openerDiscordUserId,
      opener_user_id: input.openerUserId,
      subject: input.subject,
      description: input.description,
      category: input.category,
      product: input.product,
      opener_name: input.openerName,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export type TicketOpenerProfile = Pick<Database["public"]["Tables"]["users"]["Row"], "id" | "name" | "email">;

// The linked StreamWizard account for a ticket opener, when their Discord is
// linked (discord_tickets.opener_user_id → users.id). Lets staff see who the
// opener is in StreamWizard, not just their Discord handle.
export async function getTicketOpenerProfile(client: DBClient, userId: string): Promise<TicketOpenerProfile | null> {
  const { data, error } = await client.from("users").select("id, name, email").eq("id", userId).maybeSingle();

  if (error) throw error;
  return data;
}

export async function getTicketByChannelId(client: DBClient, channelId: string): Promise<DiscordTicket | null> {
  const { data, error } = await client.from("discord_tickets").select("*").eq("channel_id", channelId).maybeSingle();

  if (error) throw error;
  return data;
}

// Claims an unclaimed ticket for a staff member. The `is null` guard makes this
// race-safe: a second claimer updates zero rows and gets null back, rather than
// silently stealing the ticket.
export async function claimTicket(
  client: DBClient,
  channelId: string,
  staffDiscordUserId: string,
  staffName: string,
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({
      claimed_by_discord_user_id: staffDiscordUserId,
      claimed_by_name: staffName,
      claimed_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId)
    .eq("status", "open")
    .is("claimed_by_discord_user_id", null)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

/** Race-safe: returns the closed row, or null when the ticket was already closed (or isn't one). */
export async function closeTicket(
  client: DBClient,
  channelId: string,
  closedByDiscordUserId: string,
  closedByName: string,
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .update({
      status: "closed",
      closed_by_discord_user_id: closedByDiscordUserId,
      closed_by_name: closedByName,
      closed_at: new Date().toISOString(),
    })
    .eq("channel_id", channelId)
    .eq("status", "open")
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Phase 2 (GitHub sync): links a ticket to its created GitHub issue.
export async function setTicketGithubIssue(
  client: DBClient,
  channelId: string,
  issueNumber: number,
  issueUrl: string,
): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ github_issue_number: issueNumber, github_issue_url: issueUrl })
    .eq("channel_id", channelId);

  if (error) throw error;
}

// The GitHub issues repo is a single fixed repo (env-configured), so the issue
// number alone is enough to find the ticket it belongs to.
export async function getTicketByGithubIssue(client: DBClient, issueNumber: number): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("*")
    .eq("github_issue_number", issueNumber)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Applies a GitHub issue status change to the ticket. Closing sets
// scheduled_deletion_at (a Supabase cron job deletes the channel once that
// time passes); reopening clears it so the channel survives.
export async function syncTicketStatusFromGithub(
  client: DBClient,
  channelId: string,
  status: "open" | "closed",
  scheduledDeletionAt: string | null,
): Promise<void> {
  const { error } = await client
    .from("discord_tickets")
    .update({ status, scheduled_deletion_at: scheduledDeletionAt })
    .eq("channel_id", channelId);

  if (error) throw error;
}

// ---------------------------------------------------------------------------
// History: transcripts, timeline and the dashboard's list/detail reads
// ---------------------------------------------------------------------------

export type DiscordTicketMessage = Database["public"]["Tables"]["discord_ticket_messages"]["Row"];
export type DiscordTicketMessageInsert = Database["public"]["Tables"]["discord_ticket_messages"]["Insert"];
export type DiscordTicketEvent = Database["public"]["Tables"]["discord_ticket_events"]["Row"];
export type DiscordTicketEventType = "opened" | "claimed" | "closed";

/** Stores a transcript and marks the ticket as saved. Upserts, so a retried close doesn't fail on duplicates. */
export async function saveTicketTranscript(
  client: DBClient,
  ticketId: string,
  messages: DiscordTicketMessageInsert[],
): Promise<void> {
  for (let i = 0; i < messages.length; i += 500) {
    const { error } = await client
      .from("discord_ticket_messages")
      .upsert(messages.slice(i, i + 500), { onConflict: "message_id" });
    if (error) throw error;
  }
  const { error } = await client
    .from("discord_tickets")
    .update({ transcript_saved_at: new Date().toISOString(), transcript_message_count: messages.length })
    .eq("id", ticketId);
  if (error) throw error;
}

export async function insertTicketEvent(
  client: DBClient,
  event: { ticketId: string; type: DiscordTicketEventType; actorDiscordId: string | null; actorName: string | null },
): Promise<void> {
  const { error } = await client.from("discord_ticket_events").insert({
    ticket_id: event.ticketId,
    type: event.type,
    actor_discord_id: event.actorDiscordId,
    actor_name: event.actorName,
  });
  if (error) throw error;
}

export interface TicketListFilters {
  status?: "open" | "closed";
  category?: DiscordTicketCategory;
  product?: string;
  /** Matches the opener's stored name or Discord id. */
  opener?: string;
  /** Matches the claimer's stored name or Discord id. */
  claimer?: string;
  /** Subject search. */
  search?: string;
  /** ISO dates, inclusive, on created_at. */
  from?: string;
  to?: string;
}

// PostgREST `or` filters take a comma-separated list, so strip the characters
// that would break out of a single ilike value.
function orSafe(value: string): string {
  return value.replace(/[,()*%\\]/g, " ").trim();
}

export async function listTickets(
  client: DBClient,
  guildId: string,
  filters: TicketListFilters,
  page: number,
  pageSize: number,
): Promise<{ tickets: DiscordTicket[]; total: number }> {
  let query = client.from("discord_tickets").select("*", { count: "exact" }).eq("guild_id", guildId);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.product) query = query.eq("product", filters.product);
  if (filters.search) query = query.ilike("subject", `%${orSafe(filters.search)}%`);
  if (filters.opener) {
    const v = orSafe(filters.opener);
    query = query.or(`opener_name.ilike.*${v}*,opener_discord_user_id.eq.${v}`);
  }
  if (filters.claimer) {
    const v = orSafe(filters.claimer);
    query = query.or(`claimed_by_name.ilike.*${v}*,claimed_by_discord_user_id.eq.${v}`);
  }
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const start = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(start, start + pageSize - 1);
  if (error) throw error;
  return { tickets: data, total: count ?? 0 };
}

export async function getTicketByNumber(
  client: DBClient,
  guildId: string,
  ticketNumber: number,
): Promise<DiscordTicket | null> {
  const { data, error } = await client
    .from("discord_tickets")
    .select("*")
    .eq("guild_id", guildId)
    .eq("ticket_number", ticketNumber)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getTicketHistory(
  client: DBClient,
  ticketId: string,
): Promise<{ messages: DiscordTicketMessage[]; events: DiscordTicketEvent[] }> {
  const [messages, events] = await Promise.all([
    client.from("discord_ticket_messages").select("*").eq("ticket_id", ticketId).order("created_at"),
    client.from("discord_ticket_events").select("*").eq("ticket_id", ticketId).order("created_at"),
  ]);
  if (messages.error) throw messages.error;
  if (events.error) throw events.error;
  return { messages: messages.data, events: events.data };
}

/** R2 keys of attachments a Discord user posted in tickets, for account deletion. */
/**
 * Removes the R2 copies of every ticket attachment this Discord user posted.
 * Shared by the delete-account action and the Twitch revoke webhook, both of
 * which run it before `delete_user_data` (which can't reach R2). Returns how
 * many objects were deleted. `deleteObject` is the storage client's method, so
 * this package stays free of a storage dependency.
 */
export async function deleteTicketAttachments(
  client: DBClient,
  discordUserId: string,
  deleteObject: (key: string) => Promise<void>,
): Promise<number> {
  const keys = await getTicketAttachmentKeysByAuthor(client, discordUserId);
  await Promise.all(keys.map((key) => deleteObject(key)));
  return keys.length;
}

export async function getTicketAttachmentKeysByAuthor(client: DBClient, discordUserId: string): Promise<string[]> {
  const { data, error } = await client
    .from("discord_ticket_messages")
    .select("attachments")
    .eq("author_discord_id", discordUserId)
    .neq("attachments", "[]");
  if (error) throw error;
  return data.flatMap((row) =>
    (row.attachments as { r2_key?: string | null }[]).map((a) => a.r2_key).filter((key): key is string => !!key),
  );
}
