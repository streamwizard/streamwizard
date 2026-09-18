import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

type DBClient = SupabaseClient<Database>;

// Tags: canned answers staff post with /tag, some of which post themselves
// when a member's message in a ticket contains one of their keywords.

export type TicketTag = Database["public"]["Tables"]["discord_ticket_tags"]["Row"];

export const TICKET_TAG_NAME_MAX = 32;
export const TICKET_TAG_CONTENT_MAX = 2000;
export const TICKET_TAG_KEYWORDS_MAX = 20;
export const TICKET_TAG_KEYWORD_MAX = 50;
/** Lowercase, digits, dash and underscore: typed after /tag, so no spaces. */
export const TICKET_TAG_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

export interface TicketTagInput {
  name: string;
  content: string;
  trigger_keywords: string[];
  auto_reply: boolean;
}

export async function listTicketTags(client: DBClient, guildId: string): Promise<TicketTag[]> {
  const { data, error } = await client
    .from("discord_ticket_tags")
    .select("*")
    .eq("guild_id", guildId)
    .order("position")
    .order("name");
  if (error) throw error;
  return data;
}

/** Keywords as stored: trimmed, lowercased, deduplicated, empty ones dropped. Matching is case-insensitive, so this loses nothing. */
export function normaliseTagKeywords(keywords: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const keyword of keywords) {
    const clean = keyword.trim().toLowerCase().slice(0, TICKET_TAG_KEYWORD_MAX);
    if (clean) seen.add(clean);
  }
  return [...seen].slice(0, TICKET_TAG_KEYWORDS_MAX);
}

export async function createTicketTag(client: DBClient, guildId: string, input: TicketTagInput & { position: number }): Promise<TicketTag> {
  const { data, error } = await client
    .from("discord_ticket_tags")
    .insert({ guild_id: guildId, ...input, trigger_keywords: normaliseTagKeywords(input.trigger_keywords) })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Null when the tag is gone. */
export async function updateTicketTag(
  client: DBClient,
  guildId: string,
  id: string,
  patch: Partial<TicketTagInput>,
): Promise<TicketTag | null> {
  const { data, error } = await client
    .from("discord_ticket_tags")
    .update(patch.trigger_keywords ? { ...patch, trigger_keywords: normaliseTagKeywords(patch.trigger_keywords) } : patch)
    .eq("guild_id", guildId)
    .eq("id", id)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** False when there was nothing to delete. */
export async function deleteTicketTag(client: DBClient, guildId: string, id: string): Promise<boolean> {
  const { data, error } = await client.from("discord_ticket_tags").delete().eq("guild_id", guildId).eq("id", id).select("id");
  if (error) throw error;
  return data.length > 0;
}

export async function reorderTicketTags(client: DBClient, guildId: string, orderedIds: string[]): Promise<void> {
  await Promise.all(
    orderedIds.map((id, position) =>
      client
        .from("discord_ticket_tags")
        .update({ position })
        .eq("guild_id", guildId)
        .eq("id", id)
        .then(({ error }) => {
          if (error) throw error;
        }),
    ),
  );
}

/** Which tags already auto-replied in a ticket (a tag_replied timeline entry each), by tag name. */
export async function listRepliedTagNames(client: DBClient, ticketId: string): Promise<Set<string>> {
  const { data, error } = await client
    .from("discord_ticket_events")
    .select("detail")
    .eq("ticket_id", ticketId)
    .eq("type", "tag_replied");
  if (error) throw error;
  const names = new Set<string>();
  for (const row of data) {
    const tag = (row.detail as { tag?: unknown } | null)?.tag;
    if (typeof tag === "string") names.add(tag);
  }
  return names;
}
