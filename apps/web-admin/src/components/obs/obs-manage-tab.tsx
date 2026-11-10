import { NodesSection } from "@/components/obs/nodes-section";
import { listNodesAction } from "@/actions/nodes/obs";
import { checkNodesHealth } from "@/lib/nodes/node-health";

export async function ObsManageTab() {
  // Registry rows plus one /health probe each, both read once with the page.
  const { data: managedNodes, error: manageError } = await listNodesAction();
  const healthByNodeId = managedNodes ? await checkNodesHealth(managedNodes) : {};

  return <NodesSection initialNodes={managedNodes ?? []} error={manageError} healthByNodeId={healthByNodeId} />;
}
