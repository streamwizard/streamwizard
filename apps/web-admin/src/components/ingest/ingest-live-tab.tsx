import { queryActiveIngestSignals } from "@repo/metrics";
import { IngestLivePanel } from "@/components/ingest/ingest-live-panel";
import { listIngestNodesAction } from "@/actions/nodes/ingest";

export async function IngestLiveTab() {
  // The socket carries node ids; the registry turns them into names.
  const [activeSignals, registry] = await Promise.all([
    queryActiveIngestSignals().catch(() => []),
    listIngestNodesAction()
      .then((res) => res.data ?? [])
      .catch(() => []),
  ]);
  const nodeNames = Object.fromEntries(registry.map((n) => [n.id, n.name]));

  return <IngestLivePanel initialSignals={activeSignals} nodeNames={nodeNames} />;
}
