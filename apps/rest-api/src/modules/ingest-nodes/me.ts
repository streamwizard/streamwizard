import type { Context } from "hono";
import { supabase } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { updateIngestNodeTailscaleIp } from "@repo/supabase/queries/ingest-nodes";
import { patchIngestNodeMeSchema } from "@/schemas/ingest-nodes";

// Called by ingest-server's install script once it actually has a Tailscale
// IP -- in the deferred-join case that's only true after /claim already
// returned (the auth key needed to join comes back IN that response), so it
// can't be included in the original claim body and needs its own round trip.
export async function updateIngestNodeMe(c: Context) {
  const parsed = patchIngestNodeMeSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "tailscale_ip must be an IPv4 address" }, 400);
  }

  const nodeId = c.get("ingestNodeId");
  const { data, error } = await updateIngestNodeTailscaleIp(supabase, nodeId, parsed.data.tailscale_ip);
  if (error) {
    // Never the DB error itself.
    reportError(new Error(error), "ingest-nodes.me.update", { nodeId });
    return c.json({ error: "Could not update the node" }, 500);
  }
  return c.json(data);
}
