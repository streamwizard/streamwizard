import type { EventSubSubscription } from "@repo/twitch-api";
import type { NeededEventSubscription } from "@repo/types";

// Pure. One channel's EventSub subscriptions on Twitch set against the list
// web-streamwizard creates at login (buildNeededEventSubscriptions). Same
// match rule as check-event-subscriptions there, so "missing" here is what a
// login would create.

/** Statuses that still deliver, or will once Twitch verifies the callback. */
const LIVE_STATUSES = new Set<string>(["enabled", "webhook_callback_verification_pending"]);

export type UserSubscriptionState =
  /** Expected, and Twitch has a live one. */
  | "ok"
  /** Expected, and nothing live on Twitch. */
  | "missing"
  /** On Twitch but dead (revoked, failures exceeded, ...). */
  | "failed"
  /** Live on Twitch, but not in the expected list (old version, other transport, other conduit). */
  | "extra";

export interface UserSubscriptionRow {
  type: string;
  version: string;
  transport: "conduit" | "webhook" | "websocket";
  state: UserSubscriptionState;
  /** The Twitch subscription, when one exists. */
  id: string | null;
  status: EventSubSubscription["status"] | null;
  createdAt: string | null;
}

export interface UserSubscriptionDiff {
  rows: UserSubscriptionRow[];
  counts: Record<UserSubscriptionState, number>;
  /** Create bodies for every missing row, for a resync. */
  missing: NeededEventSubscription[];
  /** Twitch ids of failed rows, safe to delete. */
  failedIds: string[];
}

const STATE_ORDER: Record<UserSubscriptionState, number> = { missing: 0, failed: 1, extra: 2, ok: 3 };

function matches(current: EventSubSubscription, needed: NeededEventSubscription): boolean {
  if (current.type !== needed.type || current.version !== needed.version) return false;
  if (current.transport.method !== needed.transport.method) return false;
  return needed.transport.method === "webhook"
    ? current.transport.callback === needed.transport.callback
    : current.transport.conduit_id === needed.transport.conduit_id;
}

export function diffUserSubscriptions(
  current: readonly EventSubSubscription[],
  needed: readonly NeededEventSubscription[],
): UserSubscriptionDiff {
  const rows: UserSubscriptionRow[] = [];
  const missing: NeededEventSubscription[] = [];
  const claimed = new Set<string>();

  for (const want of needed) {
    const live = current.find((sub) => !claimed.has(sub.id) && LIVE_STATUSES.has(sub.status) && matches(sub, want));
    if (live) claimed.add(live.id);
    else missing.push(want);
    rows.push({
      type: want.type,
      version: want.version,
      transport: want.transport.method,
      state: live ? "ok" : "missing",
      id: live?.id ?? null,
      status: live?.status ?? null,
      createdAt: live?.created_at ?? null,
    });
  }

  const failedIds: string[] = [];
  for (const sub of current) {
    if (claimed.has(sub.id)) continue;
    const dead = !LIVE_STATUSES.has(sub.status);
    if (dead) failedIds.push(sub.id);
    rows.push({
      type: sub.type,
      version: sub.version,
      transport: sub.transport.method,
      state: dead ? "failed" : "extra",
      id: sub.id,
      status: sub.status,
      createdAt: sub.created_at,
    });
  }

  rows.sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.type.localeCompare(b.type));
  const counts: Record<UserSubscriptionState, number> = { ok: 0, missing: 0, failed: 0, extra: 0 };
  for (const row of rows) counts[row.state]++;
  return { rows, counts, missing, failedIds };
}
