import { createHash } from "crypto";
import type { MiddlewareHandler } from "hono";
import { supabase } from "@repo/supabase";
import { lookupIngestNodeByApiKeyHash } from "@repo/supabase/queries/ingest-nodes";

declare module "hono" {
  interface ContextVariableMap {
    ingestNodeId: string;
  }
}

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
    const nodeId = await lookupIngestNodeByApiKeyHash(supabase, keyHash);

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set("ingestNodeId", nodeId);
    await next();
  };
};
