import type { Guild, GuildMember } from "discord.js";
import { supabase } from "@repo/supabase";
import {
  insertTicketEvent,
  ticketChannelName,
  type DiscordTicket,
  type DiscordTicketEventType,
  type TicketEventInput,
} from "@repo/supabase/queries/tickets";
import type { DiscordUserRef, PlatformEventPayloads, TicketEventSource } from "@repo/types";
import { reportError } from "@repo/sentry";
import { env } from "../env";
import { emitServerEvent } from "../server-log/emit";
import { memberRef } from "../server-log/refs";

const TICKET_SUBJECT_MAX = 100;

/** A member as a log payload ref, falling back to the name stored on the ticket when they left. */
async function ticketMemberRef(
  guild: Guild,
  discordUserId: string | null,
  storedName: string | null,
): Promise<DiscordUserRef | null> {
  if (!discordUserId) return null;
  const member = await guild.members.fetch(discordUserId).catch(() => null);
  return member ? memberRef(member) : { id: discordUserId, display_name: storedName };
}

/** The shared part of every ticket.* log payload. */
async function ticketEventPayload(
  guild: Guild,
  ticket: DiscordTicket,
  source: TicketEventSource,
): Promise<PlatformEventPayloads["ticket.opened"]> {
  const opener = (await ticketMemberRef(guild, ticket.opener_discord_user_id, ticket.opener_name)) ?? {
    id: ticket.opener_discord_user_id,
  };
  return {
    guild_id: guild.id,
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    subject: ticket.subject.slice(0, TICKET_SUBJECT_MAX),
    category: ticket.category,
    product: ticket.product,
    opener,
    channel: { id: ticket.channel_id, name: ticketChannelName(ticket.ticket_number), type: "text" },
    source,
    dashboard_url: env.WEB_ADMIN_URL
      ? `${env.WEB_ADMIN_URL.replace(/\/$/, "")}/discord/tickets/${ticket.ticket_number}`
      : null,
  };
}

// Timeline entries are history, not state: a failed write is reported and
// never blocks the ticket action itself. The same moment goes to the Discord
// log channel as a ticket.* event (stored even when the type is turned off,
// so the dashboard viewer keeps it).
//
// `actor` is null for a close nobody clicked for (the channel was deleted, the
// opener left). Only "closed" can be actorless in the log channel.
export async function recordTicketEvent(
  guild: Guild,
  ticket: DiscordTicket,
  type: DiscordTicketEventType,
  actor: GuildMember | null,
  source: TicketEventSource,
  extra: Pick<TicketEventInput, "targetDiscordId" | "targetName" | "detail"> = {},
): Promise<void> {
  try {
    await insertTicketEvent(supabase, {
      ticketId: ticket.id,
      type,
      actorDiscordId: actor?.id ?? null,
      actorName: actor?.displayName ?? null,
      ...extra,
    });
  } catch (error) {
    reportError(error, "discord-bot tickets: record event", { type, ticketId: ticket.id });
  }

  const base = await ticketEventPayload(guild, ticket, source);
  const options = {
    subjectDiscordId: ticket.opener_discord_user_id,
    actorDiscordId: actor?.id,
    store: "always" as const,
  };
  if (type === "opened") {
    await emitServerEvent(guild, "ticket.opened", base, options);
  } else if (type === "claimed" && actor) {
    await emitServerEvent(guild, "ticket.claimed", { ...base, actor: memberRef(actor) }, options);
  } else if (type === "closed") {
    await emitServerEvent(
      guild,
      "ticket.closed",
      {
        ...base,
        actor: actor ? memberRef(actor) : null,
        close_code: ticket.close_code,
        close_reason: ticket.close_reason,
        claimer: await ticketMemberRef(guild, ticket.claimed_by_discord_user_id, ticket.claimed_by_name),
        duration_seconds: Math.max(0, Math.round((Date.now() - new Date(ticket.created_at).getTime()) / 1000)),
        message_count: ticket.transcript_message_count,
      },
      options,
    );
  } else if (UPDATE_TYPES.has(type)) {
    const target = extra.targetDiscordId
      ? ((await ticketMemberRef(guild, extra.targetDiscordId, extra.targetName ?? null)) ?? null)
      : null;
    const detail = extra.detail ?? {};
    await emitServerEvent(
      guild,
      "ticket.updated",
      {
        ...base,
        actor: actor ? memberRef(actor) : null,
        change: type,
        target,
        from: typeof detail.from === "string" ? detail.from : null,
        to: typeof detail.to === "string" ? detail.to : null,
      },
      options,
    );
  }
}

/** Timeline types that reach the log channel as ticket.updated. The rest (stale warnings) stay on the timeline. */
const UPDATE_TYPES: ReadonlySet<DiscordTicketEventType> = new Set([
  "unclaimed",
  "priority_changed",
  "member_added",
  "member_removed",
  "moved",
  "transferred",
  "renamed",
  "close_requested",
  "close_request_accepted",
  "close_request_rejected",
  "close_request_expired",
]);

/** Logs a staff reply sent from the web-admin dashboard. No message content. */
export async function logTicketReply(guild: Guild, ticket: DiscordTicket, authorName: string): Promise<void> {
  const base = await ticketEventPayload(guild, ticket, "dashboard");
  await emitServerEvent(
    guild,
    "ticket.replied",
    { ...base, author_name: authorName },
    { subjectDiscordId: ticket.opener_discord_user_id, store: "always" },
  );
}
