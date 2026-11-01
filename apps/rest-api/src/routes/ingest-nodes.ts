import { Hono } from "hono";
import { ingestNodeAuth } from "../middleware/ingest-node-auth";
import { claimIngestNode } from "../modules/ingest-nodes/claim";
import { updateIngestNodeMe } from "../modules/ingest-nodes/me";

// /api/ingest-nodes: called by ingest-server. /claim is open (one-time token
// in the body); /me authenticates with the node API key, which sets
// c.var.ingestNodeId. Handlers live in modules/ingest-nodes/.
const ingestNodes = new Hono();

ingestNodes.post("/claim", claimIngestNode);
ingestNodes.patch("/me", ingestNodeAuth(), updateIngestNodeMe);

export default ingestNodes;
