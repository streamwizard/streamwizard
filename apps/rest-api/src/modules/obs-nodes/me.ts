import type { Context } from "hono";
import { supabase } from "@repo/supabase";
import { getNodeById, getNodeCommandKeyHash, updateNodeTailscaleIp } from "@repo/supabase/queries/obs-nodes";
import { TtlCache } from "@repo/ttl-cache";
import { env } from "../../env";
import { patchNodeMeSchema } from "../../schemas/obs-nodes";

/**
 * `/me` is two Supabase reads (node row + command key hash) on top of the auth
 * lookup, and the node agent polls it on every cycle. Both inputs are close to
 * static: `command_key_hash` is insert-only, and the only field that moves is
 * capacity, changed by an admin in web-admin — a human action measured in
 * minutes, so 30s of staleness is invisible to the agent.
 */
const ME_TTL_MS = 30 * 1000;

type NodeMePayload = NonNullable<Awaited<ReturnType<typeof getNodeById>>> & {
  command_key_hash: string | null;
  node_token_jwks: typeof env.NODE_TOKEN_PUBLIC_JWKS;
};

const meByNodeId = new TtlCache<NodeMePayload>({ ttlMs: ME_TTL_MS });

export async function getObsNodeMe(c: Context) {
  const nodeId = c.get("nodeId");
  // Cached as one composite payload rather than per-query, so a hit costs zero
  // Supabase requests instead of one. See ME_TTL_MS above for the tradeoff.
  const payload = await meByNodeId.fetch(nodeId, async () => {
    const node = await getNodeById(supabase, nodeId);
    if (!node) return null;
    // command_key_hash lets the node validate the obs-auto-switcher's Bearer on
    // its /obs route without ever holding the plaintext command key.
    const command_key_hash = await getNodeCommandKeyHash(supabase, nodeId);
    // Public keys only (schemas/env.ts refuses a private one). The node verifies the
    // short-lived tokens web-admin and web-streamwizard sign with them.
    return { ...node, command_key_hash, node_token_jwks: env.NODE_TOKEN_PUBLIC_JWKS };
  });
  if (!payload) return c.json({ error: "Node not found" }, 404);
  return c.json(payload);
}

// Called by obs-instance-manager's install script once it actually has a
// Tailscale IP -- in the deferred-join case that's only true after /claim
// already returned (the auth key needed to join comes back IN that response),
// so it can't ride the original claim body and needs its own round trip.
// Also fills in api_url as http://<ip>:3000 when the admin left it blank:
// docker-compose.yml binds the API to loopback and the Tailscale address, so
// the tailnet URL is the one default that works from other hosts. An admin
// who has pointed api_url at the node's Cloudflare Tunnel keeps that value.
export async function updateObsNodeMe(c: Context) {
  const parsed = patchNodeMeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "tailscale_ip is required" }, 400);
  }

  const nodeId = c.get("nodeId");
  const { data, error } = await updateNodeTailscaleIp(supabase, nodeId, parsed.data.tailscale_ip);
  if (error) {
    return c.json({ error }, 500);
  }
  // The node reads api_url/tailscale_ip back through GET /me, which is
  // cached for 30s -- evict so its very next poll sees what it just reported.
  meByNodeId.delete(nodeId);
  return c.json(data);
}
