import "server-only";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getActiveIngestNodeHosts } from "@repo/supabase/queries/ingest/nodes";
import { env } from "@/lib/env";

// The host cloud OBS pulls the incoming feed from, over the tailnet. Comes
// from the linked ingest node, falling back to env/placeholder only when no
// node is linked (e.g. local dev).
export async function getObsPullHost(): Promise<string> {
  const nodeHosts = await getActiveIngestNodeHosts(createAdminClient());
  return nodeHosts?.tailscale_ip ?? env.NEXT_PUBLIC_OBS_PULL_HOST ?? "your-ingest-tailscale-ip";
}
