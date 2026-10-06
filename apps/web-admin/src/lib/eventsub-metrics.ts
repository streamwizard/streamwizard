import {
  queryEventsubConnectionCounts,
  queryEventsubEventsByType,
  queryEventsubRevocations,
  queryEventsubShardHeartbeats,
  queryEventsubShardThroughput,
  queryEventsubTransportSeries,
  queryEventsubTypeTotals,
  type EventsubConnectionCount,
  type EventsubRevocationCount,
  type EventsubSeriesPoint,
  type EventsubShardHeartbeatRow,
  type EventsubShardThroughputPoint,
  type EventsubTypeTotal,
} from "@repo/metrics";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { listPlatformEvents } from "@repo/supabase/queries/platform-events";
import { TtlCache } from "@repo/ttl-cache";
import { TwitchApi, type ConduitShard, type EventSubSubscription } from "@repo/twitch-api";
import { platformEventTypesInGroup } from "@repo/types";
import { env } from "./env";
import {
  CONDUIT_TYPES,
  WEBHOOK_TYPES,
  buildSubscriptionInventory,
  toLifecycleRow,
  type LifecycleRow,
  type SubscriptionInventory,
} from "./eventsub-inventory";
import { settled } from "./settled";

export type { LifecycleRow, SubscriptionInventory, SubscriptionTypeRow } from "./eventsub-inventory";

// Server-only. Everything the /eventsub page shows, in one payload. The page
// renders it as initialData and /api/metrics/eventsub serves it to the poll,
// so both always carry the same keys. Every source is loaded on its own and
// flags its own failure, so one broken source blanks only its panels.

/** One conduit shard as Helix sees it. */
export interface HelixShard {
  id: string;
  status: ConduitShard["status"];
  sessionId: string | null;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface HelixConduit {
  id: string;
  shardCount: number;
  shards: HelixShard[];
}

export type EventsubSource = "helix" | "subscriptions" | "influx" | "lifecycle";

export interface EventsubMetrics {
  generatedAt: string;
  /** False when the Twitch credentials or conduit id aren't set here. */
  helixConfigured: boolean;
  /** True for each source that failed this load. */
  errors: Record<EventsubSource, boolean>;
  conduit: HelixConduit | null;
  /** Helix answered, but the configured conduit isn't among the app's conduits. */
  conduitMissing: boolean;
  subscriptions: SubscriptionInventory | null;
  heartbeats: EventsubShardHeartbeatRow[];
  shardThroughput: EventsubShardThroughputPoint[];
  eventsByType: EventsubSeriesPoint[];
  typeTotals: EventsubTypeTotal[];
  transport: EventsubSeriesPoint[];
  connectionCounts: EventsubConnectionCount[];
  revocations: EventsubRevocationCount[];
  lifecycle: LifecycleRow[];
  webhookTypes: string[];
  conduitTypes: string[];
}

export const EMPTY_EVENTSUB_METRICS: EventsubMetrics = {
  generatedAt: new Date(0).toISOString(),
  helixConfigured: false,
  errors: { helix: false, subscriptions: false, influx: false, lifecycle: false },
  conduit: null,
  conduitMissing: false,
  subscriptions: null,
  heartbeats: [],
  shardThroughput: [],
  eventsByType: [],
  typeTotals: [],
  transport: [],
  connectionCounts: [],
  revocations: [],
  lifecycle: [],
  webhookTypes: WEBHOOK_TYPES,
  conduitTypes: CONDUIT_TYPES,
};

/** Helix `total` is app-wide whatever the filter, so counts per type need a scan.
 * 100 pages × 100 = 10k subscriptions before the inventory reports partial. */
const SUBSCRIPTION_PAGE_CAP = 100;

const conduitCache = new TtlCache<{ conduit: HelixConduit | null; missing: boolean }>({ ttlMs: 30_000, maxEntries: 4 });
const subscriptionCache = new TtlCache<SubscriptionInventory>({ ttlMs: 5 * 60_000, maxEntries: 4 });

let twitchApi: TwitchApi | null = null;
const api = () => (twitchApi ??= new TwitchApi());

function helixConfigured(): boolean {
  return !!(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET && env.TWITCH_CONDUIT_ID);
}

async function loadConduit(conduitId: string): Promise<{ conduit: HelixConduit | null; missing: boolean }> {
  const [{ data }, shards] = await Promise.all([
    api().eventsub.getConduits(),
    api().eventsub.getAllConduitShards(conduitId).catch((error: unknown) => {
      // Twitch answers 404 for shards of a conduit that doesn't exist.
      if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
      throw error;
    }),
  ]);
  const conduit = data.find((c) => c.id === conduitId);
  if (!conduit || shards === null) return { conduit: null, missing: true };
  return {
    missing: false,
    conduit: {
      id: conduit.id,
      shardCount: conduit.shard_count,
      shards: shards
        .map((s) => ({
          id: s.id,
          status: s.status,
          sessionId: s.transport.session_id ?? null,
          connectedAt: s.transport.connected_at ?? null,
          disconnectedAt: s.transport.disconnected_at ?? null,
        }))
        .sort((a, b) => Number(a.id) - Number(b.id)),
    },
  };
}

async function loadSubscriptions(): Promise<SubscriptionInventory> {
  const all: EventSubSubscription[] = [];
  let after: string | undefined;
  let totals = { total: 0, totalCost: 0, maxTotalCost: 0 };
  let pages = 0;
  do {
    const page = await api().eventsub.getSubscriptionsPage(after ? { after } : {});
    if (pages === 0) totals = { total: page.total, totalCost: page.total_cost, maxTotalCost: page.max_total_cost };
    all.push(...page.data);
    after = page.pagination?.cursor || undefined;
    pages++;
  } while (after && pages < SUBSCRIPTION_PAGE_CAP);
  return buildSubscriptionInventory(all, totals, !!after, new Date().toISOString());
}

async function loadLifecycle(): Promise<LifecycleRow[]> {
  const from = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
  const { events } = await listPlatformEvents(supabaseAdmin, { types: platformEventTypesInGroup("eventsub"), from }, 1, 200);
  return events.map(toLifecycleRow);
}

/** Never throws: every source falls back to empty and flags its error. */
export async function fetchEventsubMetrics(fluxRange = "24h", window = "15m"): Promise<EventsubMetrics> {
  const configured = helixConfigured();
  const conduitId = env.TWITCH_CONDUIT_ID ?? "";

  const [conduit, subscriptions, heartbeats, shardThroughput, eventsByType, typeTotals, transport, connectionCounts, revocations, lifecycle] =
    await Promise.allSettled([
      configured ? conduitCache.fetch(conduitId, () => loadConduit(conduitId)) : Promise.resolve(null),
      configured ? subscriptionCache.fetch("all", loadSubscriptions) : Promise.resolve(null),
      queryEventsubShardHeartbeats("1h"),
      // Sparklines and the heatmap read the last 6h at 5m, whatever the page range.
      queryEventsubShardThroughput("6h", "5m"),
      queryEventsubEventsByType(fluxRange, window),
      queryEventsubTypeTotals(fluxRange),
      queryEventsubTransportSeries(fluxRange, window),
      queryEventsubConnectionCounts("24h"),
      queryEventsubRevocations("24h"),
      loadLifecycle(),
    ]);

  const influx = [heartbeats, shardThroughput, eventsByType, typeTotals, transport, connectionCounts, revocations];
  const conduitResult = settled(conduit, null, "eventsub helix conduit");

  return {
    generatedAt: new Date().toISOString(),
    helixConfigured: configured,
    errors: {
      helix: conduit.status === "rejected",
      subscriptions: subscriptions.status === "rejected",
      influx: influx.some((r) => r.status === "rejected"),
      lifecycle: lifecycle.status === "rejected",
    },
    conduit: conduitResult?.conduit ?? null,
    conduitMissing: conduitResult?.missing ?? false,
    subscriptions: settled(subscriptions, null, "eventsub helix subscriptions"),
    heartbeats: settled(heartbeats, [], "eventsub heartbeats"),
    shardThroughput: settled(shardThroughput, [], "eventsub shard throughput"),
    eventsByType: settled(eventsByType, [], "eventsub events by type"),
    typeTotals: settled(typeTotals, [], "eventsub type totals"),
    transport: settled(transport, [], "eventsub transport"),
    connectionCounts: settled(connectionCounts, [], "eventsub connection counts"),
    revocations: settled(revocations, [], "eventsub revocations"),
    lifecycle: settled(lifecycle, [], "eventsub lifecycle"),
    webhookTypes: WEBHOOK_TYPES,
    conduitTypes: CONDUIT_TYPES,
  };
}
