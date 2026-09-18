import { ChannelType, type Client, type Guild, type TextChannel } from "discord.js";
import { parseTicketMessages, replaceVariables, type VariableValues } from "@repo/discord-message";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { claimStaleWarning, listOpenTicketsForSweep, type SweepTicketRow } from "@repo/supabase/queries/ticket-sweep";
import { getTicketByChannelId, type DiscordTicket } from "@repo/supabase/queries/tickets";
import { guildVariableValues } from "../built-message";
import { notifyTicketActivity } from "../ticket-activity";
import { reconcileTicketTranscript } from "../ticket-transcript";
import { finalizeTicketClose } from "./close";
import { getTicketConfig, type TicketConfig } from "./config";
import { recordTicketEvent } from "./events";
import { ticketVariableValues } from "./intro";
import { selectDueTickets, type SweepSettings } from "./sweep-rules";

// The stale sweeper. Every few minutes, per server: tickets nobody has written
// in for `stale_after_hours` get a reminder; tickets whose reminder has stood
// unanswered for `auto_close_after_hours` are closed as inactivity.
//
// Restart-safe by construction. The reminder is claimed with a conditional
// UPDATE (stale_warned_at IS NULL) before anything is posted, and the close
// goes through finalizeTicketClose, whose own UPDATE only wins while the
// ticket is still open. A run that dies halfway leaves nothing a second run
// would repeat. The pure decisions are in sweep-rules.ts.

const TICK_MS = 5 * 60 * 1000;

let stopped = true;
let loop: Promise<void> | null = null;
let wake: (() => void) | undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      wake = undefined;
      resolve();
    }
    wake = done;
  });
}

function sweepSettings(config: TicketConfig): SweepSettings | null {
  if (!config.settings) return null;
  return {
    staleAfterHours: config.settings.stale_after_hours,
    autoCloseAfterHours: config.settings.auto_close_after_hours,
  };
}

/** What the reminder texts may mention. The opener may have left; their mention still renders. */
async function staleVariables(guild: Guild, ticket: DiscordTicket, config: TicketConfig, settings: SweepSettings): Promise<VariableValues> {
  const member = await guild.members.fetch(ticket.opener_discord_user_id).catch(() => null);
  return {
    ...guildVariableValues(guild),
    ...ticketVariableValues(ticket, config),
    "member.mention": `<@${ticket.opener_discord_user_id}>`,
    "member.name": member?.displayName ?? ticket.opener_name ?? "there",
    "stale.hours": String(settings.staleAfterHours ?? ""),
    "close.hours": String(settings.autoCloseAfterHours ?? ""),
  };
}

async function ticketChannel(guild: Guild, channelId: string): Promise<TextChannel | null> {
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  return channel?.type === ChannelType.GuildText ? channel : null;
}

async function warnTicket(guild: Guild, row: SweepTicketRow, config: TicketConfig, settings: SweepSettings): Promise<void> {
  // Claim first: whoever wins this UPDATE posts; everyone else sees false.
  if (!(await claimStaleWarning(supabase, row.id))) return;

  const [ticket, channel] = await Promise.all([getTicketByChannelId(supabase, row.channel_id), ticketChannel(guild, row.channel_id)]);
  if (!ticket || ticket.status !== "open") return;
  // A channel deleted by hand is closed by the startup reconcile; the claim stands so it isn't retried every tick.
  if (!channel) return;

  const messages = parseTicketMessages(config.settings?.messages);
  const template = settings.autoCloseAfterHours ? messages.closingSoon : messages.staleWarning;
  const content = replaceVariables(template, await staleVariables(guild, ticket, config, settings));
  await channel.send({
    content: content.slice(0, 2000),
    allowedMentions: { parse: [], users: [ticket.opener_discord_user_id] },
  });
  await recordTicketEvent(guild, ticket, "stale_warned", null, "system", {
    detail: { stale_hours: settings.staleAfterHours, auto_close_hours: settings.autoCloseAfterHours },
  });
  void notifyTicketActivity(guild.id, ticket.channel_id, "updated", ticket.ticket_number);
}

async function closeStaleTicket(guild: Guild, row: SweepTicketRow, config: TicketConfig, settings: SweepSettings): Promise<void> {
  const [ticket, channel] = await Promise.all([getTicketByChannelId(supabase, row.channel_id), ticketChannel(guild, row.channel_id)]);
  if (!ticket || ticket.status !== "open") return;
  if (!channel) return;

  // Like every close: the conversation is saved first, or the ticket stays open.
  const messageCount = await reconcileTicketTranscript(channel, ticket);
  const reason = replaceVariables(
    parseTicketMessages(config.settings?.messages).autoClosed,
    await staleVariables(guild, ticket, config, settings),
  );
  await finalizeTicketClose(guild, ticket, {
    code: "inactivity",
    reason: reason.slice(0, 1000),
    actor: null,
    source: "system",
    channel,
    messageCount,
  });
}

/** One pass over one server. Each ticket's failure is reported and the rest still get their turn. */
export async function sweepGuildTickets(guild: Guild, now = new Date()): Promise<{ warned: number; closed: number }> {
  const config = await getTicketConfig(guild.id);
  const settings = sweepSettings(config);
  const result = { warned: 0, closed: 0 };
  if (!settings?.staleAfterHours) return result;

  const plan = selectDueTickets(settings, await listOpenTicketsForSweep(supabase, guild.id), now);
  for (const row of plan.warn) {
    try {
      await warnTicket(guild, row, config, settings);
      result.warned++;
    } catch (error) {
      reportError(error, "discord-bot tickets: stale warning", { ticketId: row.id, ticketNumber: row.ticket_number });
    }
  }
  for (const row of plan.close) {
    try {
      await closeStaleTicket(guild, row, config, settings);
      result.closed++;
    } catch (error) {
      reportError(error, "discord-bot tickets: auto-close", { ticketId: row.id, ticketNumber: row.ticket_number });
    }
  }
  return result;
}

async function sweep(client: Client<true>): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    if (stopped) return;
    try {
      const { warned, closed } = await sweepGuildTickets(guild);
      if (warned || closed) console.log(`[tickets] Sweep in ${guild.name}: ${warned} reminded, ${closed} closed for inactivity`);
    } catch (error) {
      reportError(error, "discord-bot tickets: sweep", { guildId: guild.id });
    }
  }
}

export function startTicketSweeper(client: Client<true>): void {
  if (!stopped) return;
  stopped = false;
  loop = (async () => {
    while (!stopped) {
      await sweep(client);
      if (stopped) break;
      await sleep(TICK_MS);
    }
  })();
  console.log("[tickets] Stale sweeper started");
}

/** Stops the loop and waits for a pass in progress to finish its current ticket. */
export async function stopTicketSweeper(): Promise<void> {
  if (stopped) return;
  stopped = true;
  wake?.();
  await loop;
  loop = null;
}
