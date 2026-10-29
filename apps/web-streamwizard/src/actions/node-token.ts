"use server";

import { tryAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getInstanceNode } from "@repo/supabase/queries/obs-nodes";
import { isUserNodeScope, signNodeToken, type UserNodeScope } from "@repo/node-token";

// The browser calls the OBS node directly (start/stop, media files, ws-tickets)
// but never with the user's Supabase session. It asks here first for a node
// token: valid for 60 seconds, only on the node this instance runs on, only
// for the one action and the one instance. Both arguments come from the
// client, so the scope is checked against the streamer allowlist and the
// instance against ownership before anything is signed.
export async function mintNodeTokenAction(
  instanceId: string,
  scope: UserNodeScope,
): Promise<{ data: { token: string } | null; error: string | null }> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  if (!isUserNodeScope(scope)) return { data: null, error: "Invalid scope" };

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
