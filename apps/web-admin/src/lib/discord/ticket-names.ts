import { reportError } from "@repo/sentry";
import type { DiscordTicket, DiscordTicketEvent, DiscordTicketMessage } from "@repo/supabase/queries/tickets";
import { getGuildChannels, getGuildRoles } from "./api";
import { buildNameMap } from "./names";
import { resolveDiscordProfiles, type DiscordProfile } from "./users";

// Server-only. Names for everything a ticket page mentions: channels and
// roles from the (cached) guild lists, people from the profile cache. Used by
// the page render and by the conversation refetch, so both label mentions the
// same way.

export interface TicketNames {
  /** id → label for `<#id>`, `<@&id>` and `<@id>` mentions. A plain object: it crosses the server action boundary. */
  names: Record<string, string>;
  /** Everyone on the ticket, for the sidebar's name/username/id display. */
  profiles: Map<string, DiscordProfile>;
}

const MAX_MENTION_LOOKUPS = 25;

export async function buildTicketNames(
  ticket: DiscordTicket,
  messages: Pick<DiscordTicketMessage, "author_discord_id" | "content" | "embeds">[],
  events: Pick<DiscordTicketEvent, "actor_discord_id" | "actor_name">[],
): Promise<TicketNames> {
  // People mentioned in the conversation who didn't write in it (capped, one
  // Discord lookup each, cached across requests).
  const authors = new Set(messages.map((m) => m.author_discord_id));
  const mentioned = [...JSON.stringify(messages.map((m) => [m.content, m.embeds])).matchAll(/<@!?(\d{17,20})>/g)]
    .map((match) => match[1] ?? "")
    .filter((id) => id && !authors.has(id))
    .slice(0, MAX_MENTION_LOOKUPS);

  // Look up every person on the ticket, so usernames show even when a name is stored.
  const profiles = await resolveDiscordProfiles([
    ticket.opener_discord_user_id,
    ticket.claimed_by_discord_user_id,
    ticket.closed_by_discord_user_id,
    ticket.close_requested_by,
    ticket.created_by_discord_user_id,
    ...events.filter((e) => !e.actor_name).map((e) => e.actor_discord_id),
    ...mentioned,
  ]);

  // Channel and role names for mentions. Old tickets must still render when
  // Discord is unreachable, so this is best-effort.
  let names = new Map<string, string>();
  try {
    const [channels, roles] = await Promise.all([getGuildChannels(), getGuildRoles()]);
    names = buildNameMap(channels, roles);
  } catch (error) {
    reportError(error, "web-admin discord: ticket names");
  }
  for (const [id, profile] of profiles) names.set(id, profile.name);
  if (ticket.opener_name) names.set(ticket.opener_discord_user_id, ticket.opener_name);
  if (ticket.claimed_by_discord_user_id && ticket.claimed_by_name)
    names.set(ticket.claimed_by_discord_user_id, ticket.claimed_by_name);

  return { names: Object.fromEntries(names), profiles };
}
