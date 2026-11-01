import type { Context } from "hono";

export interface ReconcileInstance {
  instance_id: string;
  action: "marked_error" | "marked_running" | "marked_stopped" | "no_change";
}

export interface ReconcilePayload {
  reconciled_at: string;
  orphaned_containers: string[];
  instances: ReconcileInstance[];
}

// Called by obs-instance-manager after boot-time container reconciliation.
// node_id comes from the authenticated API key (obsNodeAuth), not the body.
export async function reportReconcile(c: Context) {
  const nodeId = c.get("nodeId");
  const body = (await c.req.json()) as ReconcilePayload;
  const { reconciled_at, orphaned_containers, instances } = body;

  if (!reconciled_at) {
    return c.json({ error: "reconciled_at is required" }, 400);
  }

  const corrected = instances?.filter((i) => i.action !== "no_change") ?? [];

  console.log(`[nodes] reconcile report from node ${nodeId}`, {
    reconciled_at,
    orphaned: orphaned_containers?.length ?? 0,
    corrected: corrected.length,
    total: instances?.length ?? 0,
  });

  return c.json({ ok: true });
}
