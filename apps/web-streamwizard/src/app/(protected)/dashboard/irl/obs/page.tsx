import { requireProductAccess } from "@/lib/require-product-access";
import { listIngestKeys } from "@/actions/ingest-keys";
import { CloudObsContent } from "./_cloud-obs-content";

export default async function CloudObsPage() {
  const access = await requireProductAccess("cloud_obs");
  const { data: keys } = await listIngestKeys();
  const ingestHost = process.env.NEXT_PUBLIC_INGEST_HOST ?? "your-stream-server";

  return (
    <CloudObsContent
      canInteract={access.canInteract}
      plan={access.plan}
      initialIngestKeys={keys ?? []}
      ingestHost={ingestHost}
    />
  );
}
