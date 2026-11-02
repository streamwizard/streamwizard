import { Hono } from "hono";
import { ingestNodeAuth } from "@/middleware/ingest-node-auth";
import { claimIngestNode } from "@/modules/ingest-nodes/claim";
import { updateIngestNodeMe } from "@/modules/ingest-nodes/me";
import { postSessionStats } from "@/modules/ingest-nodes/session-stats";
import { endSession, openSession } from "@/modules/ingest-nodes/sessions";
import { getWsToken } from "@/modules/ingest-nodes/ws-token";

// /api/ingest-nodes: called by ingest-server. /claim is open (one-time token
// in the body); /me authenticates with the node API key, which sets
// c.var.ingestNodeId. Handlers live in modules/ingest-nodes/.
const ingestNodes = new Hono();

ingestNodes.post("/claim", claimIngestNode);
ingestNodes.patch("/me", ingestNodeAuth(), updateIngestNodeMe);
ingestNodes.post("/me/ws-token", ingestNodeAuth(), getWsToken);

// Sessions the calling node opens, ends and reports stats for. The node never
// names the user: it comes from the stream key or the session row.
ingestNodes.post("/sessions", ingestNodeAuth(), openSession);
ingestNodes.post("/sessions/:id/end", ingestNodeAuth(), endSession);
ingestNodes.post("/session-stats", ingestNodeAuth(), postSessionStats);

export default ingestNodes;
