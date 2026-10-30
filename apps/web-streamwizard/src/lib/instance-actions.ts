import { nodeAuthHeader } from "@/lib/node-token";

// Calls obs-instance-manager's user-scoped POST /instances/:id/start|stop.
// Used by the end-user pages (deck, cloud OBS dashboard) where the caller
// owns the instance. Authorized with a node token, never the session.
export async function toggleInstance(apiUrl: string, instanceId: string, action: "start" | "stop"): Promise<{ status: string }> {
  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances/${instanceId}/${action}`, {
    method: "POST",
    headers: { Authorization: await nodeAuthHeader(instanceId, "instances:control") },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to ${action} container (${res.status})`);
  }

  return (await res.json()) as { status: string };
}
