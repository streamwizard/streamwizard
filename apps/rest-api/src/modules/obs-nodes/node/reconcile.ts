import type { ReconcileReport } from "@/modules/obs-nodes/schemas";

// Called by obs-instance-manager after boot-time container reconciliation.
// node_id comes from the authenticated API key (obsNodeAuth), not the body.
export function recordReconcileReport(nodeId: string, report: ReconcileReport): void {
  const { reconciled_at, orphaned_containers = [], instances = [] } = report;

  const corrected = instances.filter((i) => i.action !== "no_change");

  console.log(`[nodes] reconcile report from node ${nodeId}`, {
    reconciled_at,
    orphaned: orphaned_containers.length,
    corrected: corrected.length,
    total: instances.length,
  });
}
