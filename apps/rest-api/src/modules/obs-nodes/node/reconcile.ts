import type { Context } from "hono";
import { reconcileReportSchema } from "@/schemas/obs-nodes";

// Called by obs-instance-manager after boot-time container reconciliation.
// node_id comes from the authenticated API key (obsNodeAuth), not the body.
export async function reportReconcile(c: Context) {
  const nodeId = c.get("nodeId");
  const parsed = reconcileReportSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json({ error: "Invalid reconcile report" }, 400);
  }
  const { reconciled_at, orphaned_containers = [], instances = [] } = parsed.data;

  const corrected = instances.filter((i) => i.action !== "no_change");

  console.log(`[nodes] reconcile report from node ${nodeId}`, {
    reconciled_at,
    orphaned: orphaned_containers.length,
    corrected: corrected.length,
    total: instances.length,
  });

  return c.json({ ok: true });
}
