import type { Client, SendableChannels } from "discord.js";
import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { TtlCache } from "@repo/ttl-cache";
import {
  claimPlatformEvents,
  completePlatformEvent,
  listLogRoutings,
  releasePlatformEventLocks,
  resolveLogRoute,
  type LogRouting,
  type PlatformEvent,
  type PlatformEventOutcome,
} from "@repo/supabase/queries/platform-events";
import { formatPlatformEvent } from "./formatters";

// Delivers platform events (SW-334) to the StreamWizard log channel.
//
// platform_events is the queue. A Realtime insert wakes the worker straight
// away; the poll catches anything Realtime missed (bot offline, dropped
// socket). Each row is claimed with a lease, posted, then marked delivered.
// If the bot dies between posting and marking, the row is claimed again and
// the message nonce makes Discord return the first message instead of posting
// a second one.

const BATCH_SIZE = 20;
const LEASE_SECONDS = 60;
const POLL_MS = 30_000;
const SETTINGS_TTL_MS = 60_000;

let stopped = true;
let loop: Promise<void> | null = null;
let wake: (() => void) | undefined;
let wakeRequested = false;
let realtime: ReturnType<typeof supabase.channel> | null = null;
const routingCache = new TtlCache<LogRouting[]>({ ttlMs: SETTINGS_TTL_MS });

/** Call after the dashboard saves log settings so the next event re-reads them. */
export function invalidateLogSettingsCache(): void {
  routingCache.clear();
}

function requestDrain(): void {
  wakeRequested = true;
  wake?.();
}

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

async function getRoutings(): Promise<LogRouting[]> {
  return (await routingCache.fetch("all", () => listLogRoutings(supabase))) ?? [];
}

/**
 * Routing for a guild the bot is in. Server events carry their guild id;
 * platform events go to the (single) StreamWizard guild with log settings.
 */
export async function getLogRoutingFor(client: Client, guildId?: string | null): Promise<LogRouting | null> {
  const routings = (await getRoutings()).filter((routing) => client.guilds.cache.has(routing.guildId));
  if (guildId) return routings.find((routing) => routing.guildId === guildId) ?? null;
  return (
    routings.find((routing) => routing.defaultChannelId || Object.values(routing.events).some((e) => e?.channelId)) ??
    null
  );
}

/** Every channel a log posts to, so message events there aren't logged again. */
export async function getLogChannelIds(client: Client, guildId: string): Promise<Set<string>> {
  const routing = await getLogRoutingFor(client, guildId);
  if (!routing) return new Set();
  return new Set(
    [routing.defaultChannelId, ...Object.values(routing.events).map((e) => e?.channelId)].filter(
      (id): id is string => !!id,
    ),
  );
}

function payloadGuildId(event: PlatformEvent): string | null {
  const payload = event.payload;
  return payload && typeof payload === "object" && !Array.isArray(payload) && typeof payload.guild_id === "string"
    ? payload.guild_id
    : null;
}

export async function deliverPlatformEvent(client: Client, event: PlatformEvent): Promise<PlatformEventOutcome> {
  const routing = await getLogRoutingFor(client, payloadGuildId(event));
  if (!routing) return { status: "skipped", reason: "No log channel set" };
  const route = resolveLogRoute(routing, event.event_type);
  if (!route.enabled) return { status: "skipped", reason: "Event type is turned off" };
  if (!route.channelId) return { status: "skipped", reason: "No log channel set" };

  const channel = await client.channels.fetch(route.channelId).catch(() => null);
  if (!channel?.isSendable() || channel.isDMBased() || channel.guildId !== routing.guildId) {
    return { status: "failed", error: `Log channel ${route.channelId} not found, or the bot can't post there` };
  }

  const message = await (channel as SendableChannels).send({
    embeds: [formatPlatformEvent(event)],
    nonce: String(event.id),
    enforceNonce: true,
    allowedMentions: { parse: [] },
  });
  return { status: "delivered", discordMessageId: message.id };
}

async function drain(client: Client): Promise<void> {
  while (!stopped && client.isReady()) {
    wakeRequested = false;
    const events = await claimPlatformEvents(supabase, BATCH_SIZE, LEASE_SECONDS);

    for (const event of events) {
      let outcome: PlatformEventOutcome;
      try {
        outcome = await deliverPlatformEvent(client, event);
      } catch (error) {
        reportError(error, "discord-bot log-channel: deliver", { eventId: event.id, type: event.event_type });
        outcome = { status: "failed", error: error instanceof Error ? error.message : String(error) };
      }
      if (outcome.status === "failed") {
        console.warn(`[log-channel] Event #${event.id} (${event.event_type}) failed: ${outcome.error}`);
      }
      // A failure here leaves the lease to run out; the retry is deduplicated by the nonce.
      await completePlatformEvent(supabase, event.id, outcome).catch((error) =>
        reportError(error, "discord-bot log-channel: complete", { eventId: event.id }),
      );
    }

    if (events.length < BATCH_SIZE && !wakeRequested) return;
  }
}

function subscribe(): void {
  realtime = supabase
    .channel("platform-events-log")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "platform_events" }, () => requestDrain())
    .subscribe((status, error) => {
      if (status === "SUBSCRIBED") requestDrain();
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        // supabase-js rejoins on its own; the poll covers the gap.
        console.warn(`[log-channel] Realtime ${status}${error ? `: ${error.message}` : ""}`);
      }
    });
}

export async function startLogWorker(client: Client): Promise<void> {
  if (!stopped) return;
  stopped = false;

  // Single instance: a lease left over is from a process that died.
  try {
    const released = await releasePlatformEventLocks(supabase);
    if (released) console.log(`[log-channel] Released ${released} event(s) left mid-delivery`);
  } catch (error) {
    reportError(error, "discord-bot log-channel: release locks");
  }

  subscribe();

  loop = (async () => {
    while (!stopped) {
      let failed = false;
      try {
        await drain(client);
      } catch (error) {
        failed = true;
        reportError(error, "discord-bot log-channel: drain");
      }
      if (stopped) break;
      // After an error (database unreachable) always wait, or every insert
      // wake-up would retry straight away.
      if (failed || !wakeRequested) await sleep(POLL_MS);
    }
  })();
  console.log("[log-channel] Worker started");
}

/** Stops polling, waits for the current delivery to finish and closes the Realtime channel. */
export async function stopLogWorker(): Promise<void> {
  if (stopped) return;
  stopped = true;
  wake?.();
  await loop;
  loop = null;
  if (realtime) {
    await supabase.removeChannel(realtime).catch(() => undefined);
    realtime = null;
  }
}
