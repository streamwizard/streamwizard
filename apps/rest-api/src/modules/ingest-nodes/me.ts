import type { Context } from "hono";
import { supabase } from "@repo/supabase";
import { updateIngestNodeTailscaleIp } from "@repo/supabase/queries/ingest-nodes";

// Called by ingest-server's install script once it actually has a Tailscale
// IP -- in the deferred-join case that's only true after /claim already
// returned (the auth key needed to join comes back IN that response), so it
// can't be included in the original claim body and needs its own round trip.
export async function updateIngestNodeMe(c: Context) {
  const body = await c.req.json();
  const { tailscale_ip } = body as { tailscale_ip?: string };

  if (!tailscale_ip) {
    return c.json({ error: "tailscale_ip is required" }, 400);
  }

  const nodeId = c.get("ingestNodeId");
  const { data, error } = await updateIngestNodeTailscaleIp(supabase, nodeId, tailscale_ip);
  if (error) {
    return c.json({ error }, 500);
  }
  return c.json(data);
}
