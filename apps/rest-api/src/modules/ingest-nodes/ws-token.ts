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
 * → { token, ws_server_url }
 * → "unavailable" when this environment has no ws-server or no service
 *   signing key, "not_found" when the node is gone or not linked
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
export async function issueWsToken(
  nodeId: string,
): Promise<{ ok: true; token: string; ws_server_url: string } | { ok: false; reason: "unavailable" | "not_found" }> {
  const url = env.WS_SERVER_NODE_URL || env.WS_SERVER_URL;
  if (!url || !hasServiceSigningKey()) return { ok: false, reason: "unavailable" };
  const node = await getIngestNodeById(supabase, nodeId);
  if (!node || node.status !== "linked") return { ok: false, reason: "not_found" };
  const token = await signServiceToken("ingest-node", { node: nodeId });
  return { ok: true, token, ws_server_url: wsBaseUrl(url) };
}
