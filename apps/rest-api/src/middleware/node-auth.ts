import { createHash } from "crypto";
import type { MiddlewareHandler } from "hono";
import { supabase } from "@repo/supabase";
import { lookupNodeByApiKeyHash } from "@repo/supabase/queries/obs-nodes";

declare module "hono" {
  interface ContextVariableMap {
    nodeId: string;
  }
}

// Authenticates requests from OBS nodes using per-node API keys. The key is
// generated at /claim time; only its SHA-256 hash is stored in obs_node_api_keys.
// Sets c.var.nodeId on success so route handlers know which node is calling.
export const nodeAuth = (): MiddlewareHandler => {
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
    const nodeId = await lookupNodeByApiKeyHash(supabase, keyHash);

    if (!nodeId) {
      return c.json({ error: "Node API key not recognised — re-run the claim step or contact an admin" }, 401);
    }

    c.set("nodeId", nodeId);
    await next();
  };
};
