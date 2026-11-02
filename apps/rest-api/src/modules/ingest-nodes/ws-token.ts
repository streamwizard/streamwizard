import type { Context } from "hono";
import { hasServiceSigningKey, signServiceToken } from "@repo/service-token";
import { supabase } from "@repo/supabase";
import { getIngestNodeById } from "@repo/supabase/queries/ingest-nodes";
import { env } from "@/env";

/** The ws(s):// base of ws-server, without a trailing /ws (the node adds it). */
export function wsBaseUrl(url: string): string {
  return url
    .replace(/^http:/, "ws:")
    .replace(/^https:/, "wss:")
    .replace(/\/+$/, "")
    .replace(/\/ws$/, "");
}

/**
 * POST /api/ingest-nodes/me/ws-token
 * → 200 { token, ws_server_url }
 * → 404 when this environment has no ws-server or no service signing key
 *
 * The URL is WS_SERVER_NODE_URL when set (the address nodes can reach),
 * else WS_SERVER_URL.
 *
 * The node calls this before every dial of its role=ingest-node socket (at
 * most every few seconds, backing off to 30s). It reads the node row each
 * time: the key lookup in ingestNodeAuth is cached for an hour, and a deleted
 * node must not get a new token in that hour. The token is a 60-second
 * service token signed by rest-api with the node's id in its `node` claim;
 * the node can't make one for another node.
 */
export async function getWsToken(c: Context) {
  c.header("Cache-Control", "no-store");
  const url = env.WS_SERVER_NODE_URL || env.WS_SERVER_URL;
  if (!url || !hasServiceSigningKey()) {
    return c.json({ error: "No ws-server in this environment" }, 404);
  }
  const nodeId = c.get("ingestNodeId");
  const node = await getIngestNodeById(supabase, nodeId);
  if (!node || node.status !== "linked") return c.json({ error: "Node not found" }, 404);
  const token = await signServiceToken("ingest-node", { node: nodeId });
  return c.json({ token, ws_server_url: wsBaseUrl(url) });
}
