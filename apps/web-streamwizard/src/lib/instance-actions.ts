import { supabase } from "@repo/supabase/next/client";

// Calls obs-instance-manager's admin-scoped POST /admin/instances/:id/start|stop
// directly from the browser, gated by the admin's own Supabase JWT (the node
// checks the role, not instance ownership). Shared by the node detail and
// instance detail pages so both can toggle instances without duplicating the
// fetch/token logic.
export async function toggleInstance(apiUrl: string, instanceId: string, action: "start" | "stop"): Promise<{ status: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/admin/instances/${instanceId}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to ${action} container (${res.status})`);
  }

  return (await res.json()) as { status: string };
}

// Calls obs-instance-manager's admin-scoped DELETE /admin/instances/:id to
// stop the container, push OBS config, and delete the DB record.
export async function removeInstance(apiUrl: string, instanceId: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/admin/instances/${instanceId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to remove instance (${res.status})`);
  }
}

// Calls obs-instance-manager's own POST /instances directly from the browser,
// same auth pattern as toggleInstance. Creates the instance under whichever
// user is currently signed in (the admin), for quick testing.
export async function createTestInstance(apiUrl: string): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({}),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to create instance (${res.status})`);
  }
}
