import { createHash } from "crypto";
import type { MiddlewareHandler } from "hono";
import { supabase } from "@repo/supabase";
import { lookupNodeByApiKeyHash } from "@repo/supabase/queries/obs-nodes";
import { TtlCache } from "@repo/ttl-cache";

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
export const obsNodeAuth = (): MiddlewareHandler => {
  return async (c, next) => {
    const auth = c.req.header("Authorization");

    if (!auth) {
      return c.json({ error: "Authorization header is required" }, 401);
    }

    if (!auth.startsWith("Bearer ")) {
      return c.json({ error: "Authorization header must use Bearer scheme" }, 401);
    }

    const token = auth.slice(7).trim();

    if (!token) {
      return c.json({ error: "Bearer token is empty" }, 401);
    }

    // Keyed on the hash, never the plaintext token — the hash is already what
    // the table stores, so the cache holds nothing the database doesn't.
    const keyHash = createHash("sha256").update(token).digest("hex");
    const nodeId = await nodeIdByKeyHash.fetch(keyHash, () => lookupNodeByApiKeyHash(supabase, keyHash));

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set("nodeId", nodeId);
    await next();
  };
};
