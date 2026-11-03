import { supabase } from "@repo/supabase";
import { getIngestSessionRoute } from "@repo/supabase/queries/ingest";
import { TtlCache } from "@repo/ttl-cache";

// Live ingest sessions: who a session's stats belong to and which node may
// send them. rest-api registers a session when it opens one and ends it when
// the node closes it (POST /internal/ingest-sessions). An ingest node only
// sends a session id with each sample; this registry turns that into the
// user, stream key and label, and drops samples for sessions the node didn't
// open.
//
// The DB lookup on a miss is what makes this correct, not an optimisation.
// The map is per process: a ws-server restart empties it while nodes
// reconnect and keep streaming, and with more than one replica a
// registration only reaches one of them. The miss path covers both.

export interface IngestSessionEntry {
  userId: string;
  /** null for sessions opened before ingest_sessions.node_id existed. */
  nodeId: string | null;
  streamKeyId: string;
  label: string | null;
  /** Epoch ms the session ended, if it has. */
  endedAt?: number;
}

export interface RegisterIngestSession {
  sessionId: string;
  userId: string;
  nodeId: string;
  streamKeyId: string;
  label: string | null;
}

export interface IngestSessionRegistryOptions {
  /** Loads a session the map doesn't know. null when it doesn't exist. */
  lookup: (sessionId: string) => Promise<IngestSessionEntry | null>;
  /** How long an ended session is kept, so samples still in flight drop quietly. */
  endedGraceMs?: number;
  /** How long an unknown id is remembered, so junk ids can't hammer the DB. */
  missTtlMs?: number;
  /** Cap on remembered sessions; the oldest go first. */
  maxEntries?: number;
  /** DB lookups one node may cause per window. Beyond it a miss is dropped
   *  without a lookup, so a node sending junk ids can't load the database. */
  lookupsPerWindow?: number;
  lookupWindowMs?: number;
  /** Cap on lookups in flight across all nodes. */
  maxInflight?: number;
  now?: () => number;
}

export function createIngestSessionRegistry(options: IngestSessionRegistryOptions) {
  const endedGraceMs = options.endedGraceMs ?? 30_000;
  const missTtlMs = options.missTtlMs ?? 5_000;
  const maxEntries = options.maxEntries ?? 20_000;
  const lookupsPerWindow = options.lookupsPerWindow ?? 20;
  const lookupWindowMs = options.lookupWindowMs ?? 10_000;
  const maxInflight = options.maxInflight ?? 200;
  const now = options.now ?? Date.now;

  const sessions = new Map<string, IngestSessionEntry>();
  /** Session ids the DB didn't know, remembered for missTtlMs. */
  const misses = new TtlCache<true>({ ttlMs: missTtlMs, maxEntries, now });
  const inflight = new Map<string, Promise<IngestSessionEntry | null>>();
  /** requester -> lookups in the current window (fixed window from the first lookup) */
  const budgets = new TtlCache<{ used: number }>({ ttlMs: lookupWindowMs, maxEntries, now });

  /** Map insertion order is age order: drop the oldest entry when full. */
  function capped<V>(map: Map<string, V>): void {
    if (map.size >= maxEntries) {
      const oldest = map.keys().next();
      if (!oldest.done) map.delete(oldest.value);
    }
  }

  function takeLookup(requester: string): boolean {
    const budget = budgets.get(requester);
    if (!budget) {
      budgets.set(requester, { used: 1 });
      return true;
    }
    if (budget.used >= lookupsPerWindow) return false;
    budget.used++;
    return true;
  }

  function remember(sessionId: string, entry: IngestSessionEntry): void {
    if (!sessions.has(sessionId)) capped(sessions);
    sessions.set(sessionId, entry);
  }

  /** Ended entries are evicted lazily, on the next read after the grace period. */
  function live(sessionId: string): IngestSessionEntry | undefined {
    const entry = sessions.get(sessionId);
    if (entry?.endedAt !== undefined && now() - entry.endedAt > endedGraceMs) {
      sessions.delete(sessionId);
      return undefined;
    }
    return entry;
  }

  return {
    register(input: RegisterIngestSession): void {
      misses.delete(input.sessionId);
      remember(input.sessionId, {
        userId: input.userId,
        nodeId: input.nodeId,
        streamKeyId: input.streamKeyId,
        label: input.label,
      });
    },

    /** Marks a session ended. Unknown ids get a tombstone, so a late sample
     *  is dropped without a DB lookup. */
    end(sessionId: string): void {
      const entry = sessions.get(sessionId);
      const endedAt = now();
      if (entry) entry.endedAt = endedAt;
      else remember(sessionId, { userId: "", nodeId: null, streamKeyId: "", label: null, endedAt });
    },

    /**
     * The session, from memory or (once per id) the DB. null when unknown, and
     * also when `requester` (the node asking) has used up its lookups for now
     * or too many lookups are already in flight.
     */
    async resolve(sessionId: string, requester = "unknown"): Promise<IngestSessionEntry | null> {
      const hit = live(sessionId);
      if (hit) return hit;

      if (misses.get(sessionId) !== undefined) return null;

      const pending = inflight.get(sessionId);
      if (pending) return pending;
      if (inflight.size >= maxInflight || !takeLookup(requester)) return null;

      const load = (async () => {
        try {
          const entry = await options.lookup(sessionId);
          if (!entry) {
            misses.set(sessionId, true);
            return null;
          }
          // A session that ended before the lookup still gets the grace
          // period from now, then falls out like any other ended entry.
          if (entry.endedAt !== undefined) entry.endedAt = Math.max(entry.endedAt, now());
          remember(sessionId, entry);
          return entry;
        } finally {
          inflight.delete(sessionId);
        }
      })();
      inflight.set(sessionId, load);
      return load;
    },

    size(): number {
      return sessions.size;
    },
  };
}

export type IngestSessionRegistry = ReturnType<typeof createIngestSessionRegistry>;

export const ingestSessions = createIngestSessionRegistry({
  async lookup(sessionId) {
    const row = await getIngestSessionRoute(supabase, sessionId);
    if (!row) return null;
    return {
      userId: row.user_id,
      nodeId: row.node_id,
      streamKeyId: row.key_id,
      label: row.label,
      ...(row.ended_at ? { endedAt: Date.parse(row.ended_at) } : {}),
    };
  },
});
