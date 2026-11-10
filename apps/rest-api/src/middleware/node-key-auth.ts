import { createHash } from "crypto";
import type { ContextVariableMap, MiddlewareHandler } from "hono";
import { readBearerToken } from "@repo/service-token/bearer";
import type { TtlCache } from "@repo/ttl-cache";

/** Context variables that hold a node id (string-valued keys only). */
type NodeIdVar = {
  [K in keyof ContextVariableMap]: ContextVariableMap[K] extends string ? K : never;
}[keyof ContextVariableMap];

export interface NodeKeyAuthOptions {
  /** Key hash -> node id. One instance per key space, so two can never collide. */
  cache: TtlCache<string>;
  /** Finds the node that owns this SHA-256 key hash, or null. */
  lookup: (keyHash: string) => Promise<string | null>;
  /** Where the node id goes on success (`c.var[varName]`). */
  varName: NodeIdVar;
}

/**
 * Builds the middleware that authenticates a node by its per-node API key:
 * `Authorization: Bearer <key>`, matched by SHA-256 hash, with the lookup
 * cached in `cache`. The OBS and ingest node guards share this so they can't
 * drift apart.
 */
export function createNodeKeyAuth({ cache, lookup, varName }: NodeKeyAuthOptions): () => MiddlewareHandler {
  return () => async (c, next) => {
    const auth = c.req.header("Authorization");

    if (!auth) {
      return c.json({ error: "Authorization header is required" }, 401);
    }

    const bearer = readBearerToken(auth);
    if (bearer === null) {
      return c.json({ error: "Authorization header must use Bearer scheme" }, 401);
    }

    const token = bearer.trim();

    if (!token) {
      return c.json({ error: "Bearer token is empty" }, 401);
    }

    // Keyed on the hash, never the plaintext token — the hash is already what
    // the table stores, so the cache holds nothing the database doesn't.
    const keyHash = createHash("sha256").update(token).digest("hex");
    const nodeId = await cache.fetch(keyHash, () => lookup(keyHash));

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set(varName, nodeId);
    await next();
  };
}
