import { createHash } from "crypto";
import type { MiddlewareHandler } from "hono";
import { supabase } from "@repo/supabase";
import { lookupIngestNodeByApiKeyHash } from "@repo/supabase/queries/ingest-nodes";
import { TtlCache } from "@repo/ttl-cache";

declare module "hono" {
  interface ContextVariableMap {
    ingestNodeId: string;
  }
}

/** Same cache, same reasoning, same staleness tradeoff as `obs-node-auth.ts` —
 *  read that comment before changing either TTL. A deleted node's key keeps
 *  passing this check until its entry expires, so every route behind it must
 *  hold up on its own once the node row is gone:
 *  - `PATCH /me` updates the node's own row, which no longer matches.
 *  - `POST /sessions` inserts with this node_id, which the foreign key refuses.
 *  - `/sessions/:id/end` and `/session-stats` only match the node's sessions,
 *    whose node_id became NULL with the delete.
 *  - `POST /me/ws-token` reads the node row itself and refuses (ws-token.ts);
 *    web-admin also closes the node's open socket on delete.
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
export const ingestNodeAuth = (): MiddlewareHandler => {
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

    const keyHash = createHash("sha256").update(token).digest("hex");
    const nodeId = await ingestNodeIdByKeyHash.fetch(keyHash, () => lookupIngestNodeByApiKeyHash(supabase, keyHash));

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set("ingestNodeId", nodeId);
    await next();
  };
};
