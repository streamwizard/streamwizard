import { Hono } from "hono";
import { parseUuid } from "@/lib/node-schemas";
import { ingestNodeAuth } from "@/middleware/ingest-node-auth";
import { claimIngestNode, type ClaimFailure } from "@/modules/ingest-nodes/claim";
import { updateIngestNodeMe } from "@/modules/ingest-nodes/me";
import {
  claimIngestNodeSchema,
  endIngestSessionSchema,
  ingestSessionStatsSchema,
  openIngestSessionSchema,
  patchIngestNodeMeSchema,
} from "@/modules/ingest-nodes/schemas";
import { storeSessionStats } from "@/modules/ingest-nodes/session-stats";
import { endSession, openSession } from "@/modules/ingest-nodes/sessions";
import { issueWsToken } from "@/modules/ingest-nodes/ws-token";

// /api/ingest-nodes: called by ingest-server. /claim is open (one-time token
// in the body); every other route authenticates with the node API key, which
// sets c.var.ingestNodeId. Each handler reads and parses the request, calls
// the domain code in this module with plain values, and shapes the response.

const CLAIM_FAILURES = {
  invalid_token: { status: 404, error: "Invalid claim token" },
  already_claimed: { status: 409, error: "This node has already been claimed" },
  expired: { status: 410, error: "Claim token has expired" },
} as const satisfies Record<ClaimFailure, { status: number; error: string }>;

const INVALID_BODY = { error: "Invalid body" };

export const ingestNodeRoutes = new Hono();

ingestNodeRoutes.post("/claim", async (c) => {
  // Parsed before anything else: a malformed body costs no lookup.
  const parsed = claimIngestNodeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid body: token is required" }, 400);
  }
  const result = await claimIngestNode(parsed.data);
  if (!result.ok) {
    const { status, error } = CLAIM_FAILURES[result.reason];
    return c.json({ error }, status);
  }
  return c.json(result.credentials);
});

ingestNodeRoutes.patch("/me", ingestNodeAuth(), async (c) => {
  const parsed = patchIngestNodeMeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "tailscale_ip must be an IPv4 address" }, 400);
  }
  const result = await updateIngestNodeMe(c.var.ingestNodeId, parsed.data.tailscale_ip);
  if (!result.ok) return c.json({ error: "Could not update the node" }, 500);
  return c.json(result.node);
});

// A 60-second ws-server service token for the node's role=ingest-node socket.
ingestNodeRoutes.post("/me/ws-token", ingestNodeAuth(), async (c) => {
  c.header("Cache-Control", "no-store");
  const result = await issueWsToken(c.var.ingestNodeId);
  if (result.ok) return c.json({ token: result.token, ws_server_url: result.ws_server_url });
  if (result.reason === "unavailable") return c.json({ error: "No ws-server in this environment" }, 404);
  return c.json({ error: "Node not found" }, 404);
});

// Sessions the calling node opens, ends and reports stats for. The node never
// names the user: it comes from the stream key or the session row.
ingestNodeRoutes.post("/sessions", ingestNodeAuth(), async (c) => {
  const parsed = openIngestSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(INVALID_BODY, 400);
  const result = await openSession(c.var.ingestNodeId, parsed.data);
  if (result.ok) return c.json(result.session, 201);
  switch (result.reason) {
    case "rate_limited":
      return c.json({ error: "Too many invalid stream keys" }, 429);
    case "invalid_key":
      return c.json({ error: "Invalid stream key" }, 403);
    case "failed":
      return c.json({ error: "Could not open the session" }, 500);
  }
});

ingestNodeRoutes.post("/sessions/:id/end", ingestNodeAuth(), async (c) => {
  const id = parseUuid(c.req.param("id"));
  if (!id) return c.json({ error: "Session not found" }, 404);
  const parsed = endIngestSessionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(INVALID_BODY, 400);
  if (!(await endSession(c.var.ingestNodeId, id, parsed.data.last_bitrate_kbps))) {
    return c.json({ error: "Session not found" }, 404);
  }
  return c.json({ ok: true });
});

ingestNodeRoutes.post("/session-stats", ingestNodeAuth(), async (c) => {
  const parsed = ingestSessionStatsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json(INVALID_BODY, 400);
  const inserted = await storeSessionStats(c.var.ingestNodeId, parsed.data.rows);
  if (inserted === null) return c.json({ error: "Could not store the stats" }, 500);
  return c.json({ ok: true, inserted }, 202);
});
