"use server";

import { tryAuthContext } from "@/lib/auth";
import { getCloudObsAccess, NO_CLOUD_OBS_PLAN } from "@/lib/cloud-obs-access";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getInstanceNode } from "@repo/supabase/queries/obs-nodes";
import { isUserNodeScope, signNodeToken, type UserNodeScope } from "@repo/node-token";

// The browser calls the OBS node directly (start/stop, media files, ws-tickets)
// but never with the user's Supabase session. It asks here first for a node
// token: valid for 60 seconds, only on the node this instance runs on, only
// for the one action and the one instance. Both arguments come from the
// client, so the scope is checked against the streamer allowlist and the
// instance against ownership before anything is signed. The plan is checked
// too: no token at all without access, and nothing that creates an instance
// without a plan that may start things. Starting an existing instance is
// checked again on the node, so a past_due user can still stop theirs.
export async function mintNodeTokenAction(
  instanceId: string,
  scope: UserNodeScope,
): Promise<{ data: { token: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  if (!isUserNodeScope(scope)) return { data: null, error: "Invalid scope" };

  const access = await getCloudObsAccess(ctx.supabase);
  if (!access.canAccess || (scope === "instances:create" && !access.canInteract)) {
    return { data: null, error: NO_CLOUD_OBS_PLAN };
  }

  const node = await getInstanceNode(createAdminClient(), instanceId, ctx.user.id);
  if (!node) return { data: null, error: "Instance not found." };

  try {
    const token = await signNodeToken({ nodeId: node.nodeId, userId: ctx.user.id, scope, instanceId, role: "user" });
    return { data: { token }, error: null };
  } catch (err) {
    console.error("node token signing failed", err);
    return { data: null, error: "Couldn't authorize this request. Try again in a moment." };
  }
}
