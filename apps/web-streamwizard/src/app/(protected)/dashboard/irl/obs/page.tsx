import { requireProductAccess } from "@/lib/require-product-access";
import { listIngestKeys } from "@/actions/ingest-keys";
import { getAutoSwitcherConfig } from "@/actions/supabase/auto-switcher";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getActiveIngestNodeHosts } from "@repo/supabase/queries/ingest-nodes";
import { CloudObsContent } from "./_cloud-obs-content";

export default async function CloudObsPage() {
  const access = await requireProductAccess("cloud_obs");
  const [{ data: keys }, autoSwitcherConfig, nodeHosts] = await Promise.all([
    listIngestKeys(),
    getAutoSwitcherConfig(),
    getActiveIngestNodeHosts(createAdminClient()),
  ]);

  // Encoders push to the node's public domain (when ops has set one) or its
  // public IP; the cloud OBS instance pulls the feed back over the tailnet.
  // Both come from the linked ingest node, falling back to env/placeholder
  // only when no node is linked (e.g. local dev).
  const ingestHost =
    nodeHosts?.public_hostname ?? nodeHosts?.public_ip ?? process.env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server";
  const obsPullHost = nodeHosts?.tailscale_ip ?? process.env.NEXT_PUBLIC_OBS_PULL_HOST ?? "your-ingest-tailscale-ip";

  return (
    <CloudObsContent
      canInteract={access.canInteract}
      plan={access.plan}
      initialIngestKeys={keys ?? []}
      ingestHost={ingestHost}
      obsPullHost={obsPullHost}
      autoSwitcherConfig={autoSwitcherConfig}
    />
  );
}
