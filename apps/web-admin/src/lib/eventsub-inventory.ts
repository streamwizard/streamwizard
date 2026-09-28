import type { EventSubSubscription } from "@repo/twitch-api";
import type { PlatformEvent } from "@repo/supabase/queries/platform-events";
import { CONDUIT_SUBSCRIPTIONS, WEBHOOK_SUBSCRIPTIONS } from "@repo/types";

// Pure shaping for the /eventsub loader, kept apart from eventsub-metrics.ts
// so tests don't pull in env, Supabase or Helix.

export const WEBHOOK_TYPES = [...new Set(WEBHOOK_SUBSCRIPTIONS.map((s) => s.type))];
export const CONDUIT_TYPES = [...new Set(CONDUIT_SUBSCRIPTIONS.map((s) => s.type))];

/** Subscription counts by type, one row per type. */
export interface SubscriptionTypeRow {
  type: string;
  transport: "webhook" | "conduit" | "websocket" | "unknown";
  total: number;
  /** Per status; "enabled" is the healthy one. */
  byStatus: Record<string, number>;
  /** Whether StreamWizard expects this type (it's in the shared lists). */
  expected: boolean;
}

export interface SubscriptionInventory {
  /** Twitch's own count across every subscription the app has. */
  total: number;
  totalCost: number;
  maxTotalCost: number;
  byStatus: Record<string, number>;
  types: SubscriptionTypeRow[];
  /** The scan stopped at the page cap, so counts cover only part of the list. */
  partial: boolean;
  scannedAt: string;
}

/** One eventsub.* row from platform_events, flattened for the timeline. */
export interface LifecycleRow {
  id: number;
  type: string;
  createdAt: string;
  service: string | null;
  shardId: string | null;
  sessionId: string | null;
  reason: string | null;
  closeCode: number | null;
  downtimeMs: number | null;
  error: string | null;
}

/** Counts a scanned subscription list by type and status. */
export function buildSubscriptionInventory(
  subscriptions: Pick<EventSubSubscription, "type" | "status" | "transport">[],
  totals: { total: number; totalCost: number; maxTotalCost: number },
  partial: boolean,
  scannedAt: string,
): SubscriptionInventory {
  const byStatus: Record<string, number> = {};
  const types = new Map<string, SubscriptionTypeRow>();
  const expected = new Set<string>([...WEBHOOK_TYPES, ...CONDUIT_TYPES]);

  for (const sub of subscriptions) {
    byStatus[sub.status] = (byStatus[sub.status] ?? 0) + 1;
    const method = sub.transport?.method;
    const transport: SubscriptionTypeRow["transport"] =
      method === "webhook" || method === "conduit" || method === "websocket" ? method : "unknown";
    // channel.update is subscribed on both transports, so rows key on both.
    const key = `${sub.type}|${transport}`;
    const row = types.get(key) ?? { type: sub.type, transport, total: 0, byStatus: {}, expected: expected.has(sub.type) };
    row.total++;
    row.byStatus[sub.status] = (row.byStatus[sub.status] ?? 0) + 1;
    types.set(key, row);
  }

  return {
    ...totals,
    byStatus,
    types: [...types.values()].sort((a, b) => b.total - a.total || a.type.localeCompare(b.type)),
    partial,
    scannedAt,
  };
}

const str = (value: unknown): string | null => (typeof value === "string" && value ? value : null);
const int = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);

/** Flattens an eventsub.* platform_events row. */
export function toLifecycleRow(event: Pick<PlatformEvent, "id" | "event_type" | "created_at" | "payload">): LifecycleRow {
  const payload = (event.payload && typeof event.payload === "object" && !Array.isArray(event.payload)
    ? event.payload
    : {}) as Record<string, unknown>;
  return {
    id: event.id,
    type: event.event_type,
    createdAt: event.created_at,
    service: str(payload.service),
    // Rows from before the bot ran shards have no shard_id; shard 0 was the only one.
    shardId: str(payload.shard_id) ?? "0",
    sessionId: str(payload.session_id),
    reason: str(payload.reason) ?? str(payload.subscription_type),
    closeCode: int(payload.close_code),
    downtimeMs: int(payload.downtime_ms),
    error: str(payload.error),
  };
}

