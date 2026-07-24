import { supabase } from "@repo/supabase/next/client";

// Calls obs-instance-manager's user-scoped POST /instances/:id/start|stop.
// Used by the end-user pages (deck, cloud OBS dashboard) where the caller
// owns the instance.
export async function toggleInstance(apiUrl: string, instanceId: string, action: "start" | "stop"): Promise<{ status: string }> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Not signed in.");

  const res = await fetch(`${apiUrl.replace(/\/$/, "")}/instances/${instanceId}/${action}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Failed to ${action} container (${res.status})`);
  }

  return (await res.json()) as { status: string };
}

// Calls obs-instance-manager's admin-scoped POST /admin/instances/:id/start|stop.
// Used by the admin node/instance detail pages, where the instance usually
// belongs to another user — the user-scoped route would 404 on the ownership
// check, so authority comes from the admin role instead.
export async function toggleInstanceAdmin(apiUrl: string, instanceId: string, action: "start" | "stop"): Promise<{ status: string }> {
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
