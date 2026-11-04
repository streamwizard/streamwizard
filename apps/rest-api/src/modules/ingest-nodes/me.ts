import { supabase } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { updateIngestNodeTailscaleIp } from "@repo/supabase/queries/ingest-nodes";

// Called by ingest-server's install script once it actually has a Tailscale
// IP -- in the deferred-join case that's only true after /claim already
// returned (the auth key needed to join comes back IN that response), so it
// can't be included in the original claim body and needs its own round trip.
export async function updateIngestNodeMe(nodeId: string, tailscaleIp: string) {
  const { data, error } = await updateIngestNodeTailscaleIp(supabase, nodeId, tailscaleIp);
  if (error) {
    // Never the DB error itself.
    reportError(new Error(error), "ingest-nodes.me.update", { nodeId });
    return { ok: false as const };
  }
  return { ok: true as const, node: data };
}
