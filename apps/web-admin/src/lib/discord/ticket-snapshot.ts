import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listTicketMembers } from "@repo/supabase/queries/ticket-lifecycle";
import {
  getTicketHistory,
  type DiscordTicket,
  type DiscordTicketEvent,
  type DiscordTicketMessage,
} from "@repo/supabase/queries/tickets";
import type { TranscriptMessage } from "@/components/discord/ticket-transcript";
import type { DiscordProfile } from "./profile-names";
import { buildTicketNames } from "./ticket-names";

// Server-only. Everything about one ticket that can change while someone is
// looking at it, as plain data the browser can hold and patch from realtime
// rows. Static config (categories, answers, tags) travels separately: it
// doesn't change while the page is open.

export interface TicketMember {
  id: string;
  name: string;
}

export interface TicketSnapshot {
  ticket: DiscordTicket;
  messages: TranscriptMessage[];
  events: DiscordTicketEvent[];
  members: TicketMember[];
  /** id → label for `<#id>`, `<@&id>` and `<@id>` mentions. */
  names: Record<string, string>;
  /** People on the ticket, for the sidebar's name/username/id display. */
  profiles: Record<string, DiscordProfile>;
}

/** The transcript's view of a row: what the page renders, nothing more. */
export function toTranscriptMessage(m: DiscordTicketMessage): TranscriptMessage {
  return {
    id: m.id,
    author_discord_id: m.author_discord_id,
    author_name: m.author_name,
    author_avatar_url: m.author_avatar_url,
    author_is_bot: m.author_is_bot,
    content: m.content,
    embeds: m.embeds,
    attachments: m.attachments,
    created_at: m.created_at,
    edited_at: m.edited_at,
    deleted_at: m.deleted_at,
    pinned: m.pinned,
  };
}

export function toTicketMember(m: { discord_user_id: string; name: string | null }): TicketMember {
  return { id: m.discord_user_id, name: m.name ?? m.discord_user_id };
}

export async function buildTicketSnapshot(ticket: DiscordTicket): Promise<TicketSnapshot> {
  const [{ messages, events }, members] = await Promise.all([
    getTicketHistory(supabaseAdmin, ticket.id),
    listTicketMembers(supabaseAdmin, ticket.id),
  ]);
  const { names, profiles } = await buildTicketNames(ticket, messages, events);
  return {
    ticket,
    messages: messages.map(toTranscriptMessage),
    events,
    members: members.map(toTicketMember),
    names,
    profiles: Object.fromEntries(profiles),
  };
}
