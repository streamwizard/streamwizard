import { IngestNodesSection } from "@/components/ingest/ingest-nodes-section";
import { listIngestNodesAction } from "@/actions/nodes/ingest";

export async function IngestManageTab() {
  const { data: managedNodes, error: manageError } = await listIngestNodesAction();
  return <IngestNodesSection initialNodes={managedNodes ?? []} error={manageError} />;
}
