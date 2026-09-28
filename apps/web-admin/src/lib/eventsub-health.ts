import { EVENTSUB_HEARTBEAT_STALE_MIN, EVENTSUB_SILENCE_MIN } from "@repo/alerting/thresholds";
import type { EventsubShardHeartbeatRow, EventsubShardThroughputPoint } from "@repo/metrics";
import type { IndicatorStatus } from "@/components/widgets/status-indicator";
import { band, SEVERITY, worstStatus } from "@/components/charts/health-kit";
import type { EventsubMetrics, HelixShard } from "./eventsub-metrics";

// Pure: turns one /api/metrics/eventsub payload into shard statuses, banner
// checks and KPI values. Ages are measured against the payload's generatedAt,
// so server and client render the same thing and nothing ticks on its own.

export const COST_WARN_PCT = 80;
export const COST_CRIT_PCT = 95;
/** At or below this many shards the grid shows one tile each. */
export const TILE_VIEW_MAX_SHARDS = 12;

const STATE_BY_CODE = ["disconnected", "connecting", "reconnecting", "connected"] as const;
export type BotState = (typeof STATE_BY_CODE)[number];

export interface ShardView {
  id: string;
  status: IndicatorStatus;
  /** Short state in words; the dot never carries the meaning alone. */
  label: string;
  /** One sentence for tooltips and the problem table. */
  detail: string;
  helix: HelixShard | null;
  heartbeat: EventsubShardHeartbeatRow | null;
  botState: BotState | null;
  heartbeatAgeMs: number | null;
  /** The latest heartbeat is too old to describe the shard now. */
  stale: boolean;
  /** Conduit notifications per minute from the latest heartbeat. */
  eventsPerMin: number | null;
  lost24h: number;
  reconnectAttempts24h: number;
}

const staleMs = EVENTSUB_HEARTBEAT_STALE_MIN * 60_000;

function shardView(
  id: string,
  helix: HelixShard | null,
  hb: EventsubShardHeartbeatRow | null,
  nowMs: number,
  helixKnown: boolean,
  counts: { lost: number; attempts: number },
): ShardView {
  const heartbeatAgeMs = hb ? Math.max(0, nowMs - new Date(hb.time).getTime()) : null;
  const botState = hb ? (STATE_BY_CODE[hb.stateCode] ?? "disconnected") : null;
  const helixEnabled = helix?.status === "enabled";
  const stale = heartbeatAgeMs !== null && heartbeatAgeMs >= staleMs;
  const base = {
    id,
    helix,
    heartbeat: hb,
    botState,
    heartbeatAgeMs,
    stale,
    eventsPerMin: hb && !stale ? hb.notifications * 2 : null,
    lost24h: counts.lost,
    reconnectAttempts24h: counts.attempts,
  };
  const helixSays = helix ? helix.status.replace(/_/g, " ") : "unknown";

  if (!hb) {
    if (helixEnabled) {
      return { ...base, status: "ok", label: "Enabled", detail: "Helix has the shard enabled; no bot heartbeat yet (older bot or metrics off)." };
    }
    return {
      ...base,
      status: "warn",
      label: "Not running",
      detail: `No process sends heartbeats for this shard and Helix says ${helixSays}. Twitch resends its events to another shard once.`,
    };
  }
  if (stale && heartbeatAgeMs !== null) {
    return {
      ...base,
      status: "crit",
      label: "No heartbeat",
      detail: `Last heartbeat ${Math.round(heartbeatAgeMs / 60_000)}m ago; the process running this shard is probably down.`,
    };
  }
  if (hb.conduitMissing) {
    return { ...base, status: "crit", label: "Conduit missing", detail: "Twitch says the conduit doesn't exist, so the shard can't bind." };
  }
  if (botState !== "connected") {
    return {
      ...base,
      status: helix && !helixEnabled ? "crit" : "warn",
      label: "Reconnecting",
      detail: `The bot is ${botState} (attempt ${hb.reconnectAttempts}); Helix says ${helixSays}.`,
    };
  }
  if (helixKnown && helix && !helixEnabled) {
    return {
      ...base,
      status: "warn",
      label: "Mismatch",
      detail: `The bot says connected but Helix says ${helixSays}. Usually clears within a heartbeat after a reconnect.`,
    };
  }
  return { ...base, status: "ok", label: "Connected", detail: "Connected and bound." };
}

/** One view per shard seen by Helix or the heartbeats, worst first when sorting by severity. */
export function buildShardViews(m: EventsubMetrics): ShardView[] {
  const nowMs = new Date(m.generatedAt).getTime();
  const helixById = new Map((m.conduit?.shards ?? []).map((s) => [s.id, s]));
  const hbById = new Map<string, EventsubShardHeartbeatRow>();
  for (const hb of m.heartbeats) {
    const prev = hbById.get(hb.shardId);
    if (!prev || hb.time > prev.time) hbById.set(hb.shardId, hb);
  }
  const counts = new Map<string, { lost: number; attempts: number }>();
  for (const c of m.connectionCounts) {
    const entry = counts.get(c.shardId) ?? { lost: 0, attempts: 0 };
    if (c.event === "lost") entry.lost += c.count;
    if (c.event === "reconnect_attempt") entry.attempts += c.count;
    counts.set(c.shardId, entry);
  }
  const ids = [...new Set([...helixById.keys(), ...hbById.keys()])].sort((a, b) => Number(a) - Number(b));
  return ids.map((id) =>
    shardView(id, helixById.get(id) ?? null, hbById.get(id) ?? null, nowMs, m.conduit !== null, counts.get(id) ?? { lost: 0, attempts: 0 }),
  );
}

export function byWorstFirst(a: ShardView, b: ShardView): number {
  return SEVERITY[b.status] - SEVERITY[a.status] || Number(a.id) - Number(b.id);
}

export type EventsubCheckId =
  | "shards"
  | "mismatch"
  | "heartbeat"
  | "conduit"
  | "unrun"
  | "cost"
  | "revocations"
  | "silence"
  | "sources";

export interface EventsubCheck {
  id: EventsubCheckId;
  label: string;
  value: string;
  status: IndicatorStatus;
  /** The threshold in words, always shown next to the value. */
  hint: string;
  /** Banner badge text when the check fails. */
  problem: string;
}

function lastEventAgeMin(m: EventsubMetrics, nowMs: number): number | null {
  let last = 0;
  for (const p of m.transport) {
    if (p.count > 0) last = Math.max(last, new Date(p.time).getTime());
  }
  return last === 0 ? null : Math.max(0, Math.floor((nowMs - last) / 60_000));
}

export function buildEventsubChecks(m: EventsubMetrics, shards: ShardView[]): EventsubCheck[] {
  const nowMs = new Date(m.generatedAt).getTime();
  const total = shards.length;
  const up = shards.filter((s) => s.status === "ok").length;
  const mismatched = shards.filter((s) => s.label === "Mismatch").length;
  const stale = shards.filter((s) => s.label === "No heartbeat").length;
  // A stale shard had a process; the heartbeat check covers it, not this one.
  const heartbeating = shards.filter((s) => s.heartbeat).length;
  const unrun = m.conduit && heartbeating > 0 ? Math.max(0, m.conduit.shardCount - heartbeating) : 0;
  const subs = m.subscriptions;
  const costPct = subs && subs.maxTotalCost > 0 ? (100 * subs.totalCost) / subs.maxTotalCost : null;
  const revocations = m.revocations.reduce((sum, r) => sum + r.count, 0);
  const silentMin = lastEventAgeMin(m, nowMs);
  const failedSources = (Object.entries(m.errors) as [string, boolean][]).filter(([, failed]) => failed).map(([name]) => name);

  return [
    {
      id: "shards",
      label: "Shards up",
      value: total === 0 ? "—" : `${up} / ${total}`,
      status: total === 0 ? "muted" : up === 0 ? "crit" : up < total ? "warn" : "ok",
      hint: "every shard connected and bound",
      problem: `${total - up} of ${total} shards not healthy`,
    },
    {
      id: "heartbeat",
      label: "Heartbeats",
      value: m.heartbeats.length === 0 ? "—" : stale === 0 ? "fresh" : `${stale} stale`,
      status: m.heartbeats.length === 0 ? "muted" : stale > 0 ? "crit" : "ok",
      hint: `stale after ${EVENTSUB_HEARTBEAT_STALE_MIN}m`,
      problem: `${stale} shard${stale === 1 ? "" : "s"} stopped sending heartbeats`,
    },
    {
      id: "conduit",
      label: "Conduit",
      value: !m.helixConfigured ? "not configured" : m.conduitMissing ? "missing" : m.conduit ? `${m.conduit.shardCount} shards` : "—",
      status: !m.helixConfigured || (!m.conduit && !m.conduitMissing) ? "muted" : m.conduitMissing ? "crit" : "ok",
      hint: "TWITCH_CONDUIT_ID exists on Twitch",
      problem: "Conduit not found on Twitch",
    },
    {
      id: "mismatch",
      label: "Helix vs bot",
      value: m.conduit === null || m.heartbeats.length === 0 ? "—" : mismatched === 0 ? "agree" : `${mismatched} differ`,
      status: m.conduit === null || m.heartbeats.length === 0 ? "muted" : mismatched > 0 ? "warn" : "ok",
      hint: "both say connected",
      problem: `Helix and the bot disagree on ${mismatched} shard${mismatched === 1 ? "" : "s"}`,
    },
    {
      id: "unrun",
      label: "Unrun shards",
      value: m.conduit === null || heartbeating === 0 ? "—" : String(unrun),
      status: m.conduit === null || heartbeating === 0 ? "muted" : unrun > 0 ? "warn" : "ok",
      hint: "shard_count = shards with a process",
      problem: `${unrun} conduit shard${unrun === 1 ? "" : "s"} with no process`,
    },
    {
      id: "cost",
      label: "Subscription cost",
      value: subs ? `${subs.totalCost.toLocaleString("en-US")} / ${subs.maxTotalCost.toLocaleString("en-US")}` : "—",
      status: band(costPct, { warn: COST_WARN_PCT, crit: COST_CRIT_PCT, direction: "above" }),
      hint: `warn > ${COST_WARN_PCT}% of max`,
      problem: `Cost at ${costPct === null ? "—" : costPct.toFixed(0)}% of max`,
    },
    {
      id: "revocations",
      label: "Revocations (24h)",
      value: revocations.toLocaleString("en-US"),
      status: m.errors.influx ? "muted" : revocations > 0 ? "warn" : "ok",
      hint: "should stay 0",
      problem: `${revocations} subscription${revocations === 1 ? "" : "s"} revoked in 24h`,
    },
    {
      id: "silence",
      label: "Last event",
      value: silentMin === null ? "—" : silentMin < 1 ? "just now" : `${silentMin}m ago`,
      status: silentMin === null ? "muted" : silentMin > EVENTSUB_SILENCE_MIN ? "warn" : "ok",
      hint: `warn after ${EVENTSUB_SILENCE_MIN}m`,
      problem: `No events for ${silentMin}m`,
    },
    {
      id: "sources",
      label: "Data sources",
      value: failedSources.length === 0 ? "all loaded" : `${failedSources.length} failed`,
      status: failedSources.length > 0 ? "warn" : "ok",
      hint: "Helix, Influx, event log",
      problem: `Couldn't load: ${failedSources.join(", ")}`,
    },
  ];
}

export interface EventsubSummary {
  status: IndicatorStatus;
  label: string;
  failing: EventsubCheck[];
}

export function summarize(checks: EventsubCheck[]): EventsubSummary {
  const failing = checks.filter((c) => c.status === "warn" || c.status === "crit");
  const status = worstStatus(checks.map((c) => c.status));
  const noData = checks.every((c) => c.status === "muted");
  return {
    status: noData ? "muted" : status,
    label: noData ? "No data yet" : status === "crit" ? "Critical" : status === "warn" ? "Degraded" : "Healthy",
    failing,
  };
}

export interface EventsubKpis {
  shardsUp: string;
  eventsPerMin: number | null;
  /** Enabled subscriptions, with the total for the tile's caption. */
  subscriptionsEnabled: number | null;
  subscriptionsTotal: number | null;
  /** Share of max cost used, with the raw numbers for the caption. */
  costPct: number | null;
  cost: string;
  reconnects24h: number;
  revocations24h: number;
}

export function buildKpis(m: EventsubMetrics, shards: ShardView[]): EventsubKpis {
  const rates = shards.map((s) => s.eventsPerMin).filter((r): r is number => r !== null);
  const subs = m.subscriptions;
  return {
    shardsUp: shards.length === 0 ? "—" : `${shards.filter((s) => s.status === "ok").length} / ${shards.length}`,
    eventsPerMin: rates.length === 0 ? null : rates.reduce((a, b) => a + b, 0),
    subscriptionsEnabled: subs ? (subs.byStatus.enabled ?? 0) : null,
    subscriptionsTotal: subs ? subs.total : null,
    costPct: subs && subs.maxTotalCost > 0 ? (100 * subs.totalCost) / subs.maxTotalCost : null,
    cost: subs ? `${subs.totalCost.toLocaleString("en-US")} of ${subs.maxTotalCost.toLocaleString("en-US")}` : "—",
    reconnects24h: m.connectionCounts.filter((c) => c.event === "lost").reduce((sum, c) => sum + c.count, 0),
    revocations24h: m.revocations.reduce((sum, r) => sum + r.count, 0),
  };
}

/** The shard throughput query covers 6 hours in 5-minute windows. */
export const THROUGHPUT_WINDOW_MS = 5 * 60_000;
export const THROUGHPUT_RANGE_MS = 6 * 60 * 60_000;

/**
 * One point per shard per 5-minute bucket across the whole range, null where
 * the shard sent no heartbeat. Flux stamps each window with its stop time and
 * the newest window with "now", so every time snaps up to its bucket end.
 */
export function padShardThroughput(
  points: EventsubShardThroughputPoint[],
  shardIds: string[],
  generatedAt: string,
): Map<string, EventsubShardThroughputPoint[]> {
  const snap = (ms: number) => Math.ceil(ms / THROUGHPUT_WINDOW_MS) * THROUGHPUT_WINDOW_MS;
  const end = snap(new Date(generatedAt).getTime());
  const buckets: number[] = [];
  for (let t = end - THROUGHPUT_RANGE_MS + THROUGHPUT_WINDOW_MS; t <= end; t += THROUGHPUT_WINDOW_MS) buckets.push(t);

  const counts = new Map<string, Map<number, number>>();
  for (const p of points) {
    const byBucket = counts.get(p.key) ?? new Map<number, number>();
    const bucket = snap(new Date(p.time).getTime());
    byBucket.set(bucket, (byBucket.get(bucket) ?? 0) + (p.count ?? 0));
    counts.set(p.key, byBucket);
  }

  const result = new Map<string, EventsubShardThroughputPoint[]>();
  for (const id of new Set([...shardIds, ...counts.keys()])) {
    const byBucket = counts.get(id);
    result.set(
      id,
      buckets.map((t) => ({ time: new Date(t).toISOString(), key: id, count: byBucket?.get(t) ?? null })),
    );
  }
  return result;
}
