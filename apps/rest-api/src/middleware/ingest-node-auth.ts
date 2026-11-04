import { supabase } from "@repo/supabase";
import { lookupIngestNodeByApiKeyHash } from "@repo/supabase/queries/ingest-nodes";
import { TtlCache } from "@repo/ttl-cache";
import { createNodeKeyAuth } from "@/middleware/node-key-auth";

declare module "hono" {
  interface ContextVariableMap {
    ingestNodeId: string;
  }
}

/** Key hash -> ingest node id, cached like `obs-node-auth.ts` (same TTLs).
 *  Separate instance so the two key spaces can never collide. */
const KEY_TTL_MS = 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 5 * 1000;

const ingestNodeIdByKeyHash = new TtlCache<string>({
  ttlMs: KEY_TTL_MS,
  negativeTtlMs: NEGATIVE_TTL_MS,
});

export const ingestNodeAuthCacheStats = () => ingestNodeIdByKeyHash.stats();

// Authenticates requests from ingest nodes using per-node API keys. The key is
// generated at /claim time; only its SHA-256 hash is stored in ingest_node_api_keys.
// Sets c.var.ingestNodeId on success so route handlers know which node is calling.
export const ingestNodeAuth = createNodeKeyAuth({
  cache: ingestNodeIdByKeyHash,
  lookup: (keyHash) => lookupIngestNodeByApiKeyHash(supabase, keyHash),
  varName: "ingestNodeId",
});
