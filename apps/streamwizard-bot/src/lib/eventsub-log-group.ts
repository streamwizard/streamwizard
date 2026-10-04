import type { PlatformEventPayloads } from "@repo/types";
import type { EmitPlatformEventInput } from "@repo/supabase/queries/platform-events";

/**
 * Row types that every shard of one process tends to hit together: a deploy,
 * a network blip, Twitch moving sessions. Revocations and conduit failures are
 * about one subscription or one shard, so those always stay their own row.
 */
const GROUPED_TYPES = [
  "eventsub.connected",
  "eventsub.connection_lost",
  "eventsub.reconnected",
  "eventsub.session_migrated",
] as const;

type GroupedType = (typeof GROUPED_TYPES)[number];
type GroupedRow = Extract<EmitPlatformEventInput, { type: GroupedType }>;

function isGroupedRow(event: EmitPlatformEventInput): event is GroupedRow {
  return (GROUPED_TYPES as readonly string[]).includes(event.type);
}

const payloadsOf = <T extends GroupedType>(rows: GroupedRow[]) => rows.map((row) => row.payload as PlatformEventPayloads[T]);

const highest = (values: (number | null | undefined)[]): number | null => {
  const known = values.filter((value): value is number => typeof value === "number");
  return known.length > 0 ? Math.max(...known) : null;
};

function mergeGroup(rows: GroupedRow[]): EmitPlatformEventInput {
  const first = rows[0]!;
  if (rows.length === 1) return first;

  const shardIds = rows
    .map((row) => row.payload.shard_id)
    .filter((id): id is string => id !== undefined)
    .sort((a, b) => Number(a) - Number(b));
  const origin = { service: first.payload.service, shard_ids: shardIds };

  switch (first.type) {
    case "eventsub.connected":
      return { type: "eventsub.connected", payload: { ...origin, session_id: null } };

    case "eventsub.session_migrated":
      return { type: "eventsub.session_migrated", payload: { ...origin, session_id: null } };

    case "eventsub.connection_lost": {
      const lost = payloadsOf<"eventsub.connection_lost">(rows);
      const codes = new Set(lost.map((p) => p.close_code ?? null));
      return {
        type: "eventsub.connection_lost",
        payload: {
          ...origin,
          reason: [...new Set(lost.map((p) => p.reason))].join(", "),
          // One code for the row only when every shard closed with the same one.
          close_code: codes.size === 1 ? [...codes][0]! : null,
          keepalive_silent_ms: highest(lost.map((p) => p.keepalive_silent_ms)),
        },
      };
    }

    case "eventsub.reconnected": {
      const back = payloadsOf<"eventsub.reconnected">(rows);
      return {
        type: "eventsub.reconnected",
        payload: {
          ...origin,
          session_id: null,
          // The worst shard: staff care how long events could have been missed.
          downtime_ms: highest(back.map((p) => p.downtime_ms)) ?? 0,
          attempts: highest(back.map((p) => p.attempts)) ?? 0,
        },
      };
    }
  }
}

/**
 * Merges rows of the same type from different shards into one row each, in
 * the order the first row of each group arrived. A shard that hits the same
 * type twice (lost, back, lost again) starts a new group, so a flapping
 * connection still reads as lost, reconnected, lost, reconnected.
 */
export function mergeEventSubRows(rows: EmitPlatformEventInput[]): EmitPlatformEventInput[] {
  const ordered: (EmitPlatformEventInput | GroupedRow[])[] = [];
  const open = new Map<GroupedType, GroupedRow[]>();

  for (const row of rows) {
    if (!isGroupedRow(row)) {
      ordered.push(row);
      continue;
    }
    let group = open.get(row.type);
    if (!group || group.some((other) => other.payload.shard_id === row.payload.shard_id)) {
      group = [];
      open.set(row.type, group);
      ordered.push(group);
    }
    group.push(row);
  }

  return ordered.map((entry) => (Array.isArray(entry) ? mergeGroup(entry) : entry));
}

export interface EventSubLogGroup {
  /** Queues a row. Rows that are never grouped are sent straight away. */
  emit(event: EmitPlatformEventInput): void;
  /** Sends whatever is waiting. Await it before the process exits. */
  flush(): Promise<void>;
}

export interface EventSubLogGroupOptions {
  /** Send once no new row arrived for this long */
  quietMs?: number;
  /** Send at the latest this long after the first waiting row */
  maxWaitMs?: number;
}

/**
 * Holds connection rows for a few seconds so that several shards hitting the
 * same thing become one row in the Discord log channel instead of one each.
 * Only used when the process runs more than one shard: a single shard keeps
 * writing every row the moment it happens.
 *
 * The defaults cover a boot (shards start 250 ms apart) and a blip where each
 * socket notices on its own keepalive timer.
 */
export function createEventSubLogGroup(
  send: (event: EmitPlatformEventInput) => Promise<void>,
  { quietMs = 3000, maxWaitMs = 20_000 }: EventSubLogGroupOptions = {},
): EventSubLogGroup {
  let waiting: EmitPlatformEventInput[] = [];
  let firstAt = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  // Rows are sent one after another so they land in the order they happened.
  // A failed send must not hold back the rows behind it.
  let sending: Promise<void> = Promise.resolve();
  const enqueue = (event: EmitPlatformEventInput) => {
    sending = sending.then(() => send(event)).catch(() => undefined);
  };

  const flush = (): Promise<void> => {
    if (timer) clearTimeout(timer);
    timer = null;
    const rows = mergeEventSubRows(waiting);
    waiting = [];
    for (const row of rows) enqueue(row);
    return sending;
  };

  return {
    emit(event) {
      if (!isGroupedRow(event)) {
        enqueue(event);
        return;
      }
      const now = Date.now();
      if (waiting.length === 0) firstAt = now;
      waiting.push(event);
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void flush(), Math.max(0, Math.min(quietMs, firstAt + maxWaitMs - now)));
    },
    flush,
  };
}
