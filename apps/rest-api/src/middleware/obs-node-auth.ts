import { supabase } from "@repo/supabase";
import { lookupNodeByApiKeyHash } from "@repo/supabase/queries/obs-nodes/node-api-keys";
import { TtlCache } from "@repo/ttl-cache";
import { createNodeKeyAuth } from "@/middleware/node-key-auth";

declare module "hono" {
  interface ContextVariableMap {
    nodeId: string;
  }
}

/**
 * Key hash -> node id, so the agent's poll loop stops costing a Supabase
 * request per request. Entries are cached for KEY_TTL_MS (one hour).
 */
const KEY_TTL_MS = 60 * 60 * 1000;
/** Shorter, so a wrong key retried in a loop can't amplify, but a node that
 *  just finished /claim isn't locked out for five minutes. */
const NEGATIVE_TTL_MS = 5 * 1000;

const nodeIdByKeyHash = new TtlCache<string>({
  ttlMs: KEY_TTL_MS,
  negativeTtlMs: NEGATIVE_TTL_MS,
});

export const obsNodeAuthCacheStats = () => nodeIdByKeyHash.stats();

// Authenticates requests from OBS nodes using per-node API keys. The key is
// generated at /claim time; only its SHA-256 hash is stored in obs_node_api_keys.
// Sets c.var.nodeId on success so route handlers know which node is calling.
export const obsNodeAuth = createNodeKeyAuth({
  cache: nodeIdByKeyHash,
  lookup: (keyHash) => lookupNodeByApiKeyHash(supabase, keyHash),
  varName: "nodeId",
});
