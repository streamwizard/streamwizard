"use server";

import { randomUUID } from "crypto";
import { track } from "@/lib/track";
import { tryAuthContext } from "@/lib/auth";
import { getCloudObsAccess, NO_CLOUD_OBS_PLAN } from "@/lib/cloud-obs-access";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getTwitchScopes } from "@repo/supabase/queries/twitch-scopes";
import { missingTwitchScopes } from "@repo/schemas";
import { signNodeToken } from "@repo/node-token";
import { getProductAccess, getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions";
import {
  type ObsInstance,
  getInstanceNodeApiUrl,
  getInstanceObsWsPasswordFields,
  getUserRunningInstance,
  getUserLatestInstance,
  pickAvailableNode,
} from "@repo/supabase/queries/obs-nodes";

// All actions below use the admin client so they can join across
// obs_instances and obs_nodes without requiring RLS policies on obs_nodes that
// would expose node data to end users. Ownership is enforced in the query
// predicate (user_id = userId) rather than via RLS. The lookups also need the
// plan (canAccess), like the pages they serve: after a revoke the browser can
// still hold an instance id, and these hand out the node URL and OBS password.

async function cloudObsContext() {
  const ctx = await tryAuthContext();
  if (!ctx) return { ctx: null, error: "Unauthenticated" };
  const access = await getCloudObsAccess(ctx.supabase);
  if (!access.canAccess) return { ctx: null, error: NO_CLOUD_OBS_PLAN };
  return { ctx, error: null };
}

export async function getMyRunningInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  const { ctx, error } = await cloudObsContext();
  if (!ctx) return { data: null, error };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const instance = await getUserRunningInstance(adminClient, userId);
  return { data: instance, error: null };
}

// Looks up the node api_url for an instance the calling user owns.
// The api_url must come from a trusted server-side lookup -- the client
// appends a Bearer token to the WebSocket URL, so an attacker-controlled
// URL in the query string would exfiltrate that token to an arbitrary host.
export async function getInstanceNodeApiUrlAction(
  instanceId: string,
): Promise<{ data: { apiUrl: string } | null; error: string | null }> {
  const { ctx, error } = await cloudObsContext();
  if (!ctx) return { data: null, error };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const apiUrl = await getInstanceNodeApiUrl(adminClient, instanceId, userId);
  if (!apiUrl) return { data: null, error: "Instance not found or node has no API URL." };
  return { data: { apiUrl }, error: null };
}

export async function getInstanceObsWsPasswordAction(
  instanceId: string,
): Promise<{ data: { password: string } | null; error: string | null }> {
  const { ctx, error } = await cloudObsContext();
  if (!ctx) return { data: null, error };
  const userId = ctx.user.id;

  const adminClient = createAdminClient();
  const fields = await getInstanceObsWsPasswordFields(adminClient, instanceId, userId);
  if (!fields) return { data: null, error: "Instance not found." };
  const { ciphertext, iv, tag } = fields;
  if (!ciphertext || !iv || !tag) return { data: null, error: "Password not set on this instance." };

  const { decryptToken } = await import("@repo/supabase/crypto");
  const password = decryptToken(ciphertext, iv, tag);
  return { data: { password }, error: null };
}

/** Returns the user's most recent instance regardless of status (e.g. stopped). */
export async function getMyLatestInstanceAction(): Promise<{ data: ObsInstance | null; error: string | null }> {
  const { ctx, error } = await cloudObsContext();
  if (!ctx) return { data: null, error };
  const userId = ctx.user.id;
  const adminClient = createAdminClient();
  const instance = await getUserLatestInstance(adminClient, userId);
  return { data: instance, error: null };
}

/**
 * Picks an available linked node and provisions a new OBS instance for the
 * calling user. Returns the new instance, node API URL, and OBS WS password.
 */
export async function launchMyInstanceAction(options: { resolution?: string; template?: string } = {}): Promise<{
  data: { instance: ObsInstance; apiUrl: string; password: string } | null;
  error: string | null;
}> {
  const ctx = await tryAuthContext();
  if (!ctx) return { data: null, error: "Unauthenticated" };
  const { supabase } = ctx;
  const userId = ctx.user.id;

  const adminClient = createAdminClient();

  const [node, subscriptionId, twitchScopes, access] = await Promise.all([
    pickAvailableNode(adminClient),
    getUserActiveSubscriptionId(adminClient, userId, "cloud_obs"),
    getTwitchScopes(supabase),
    getProductAccess(supabase, "cloud_obs"),
  ]);

  if (!node?.api_url) {
    await track("cloud_obs_launch_failed", { reason: "no_capacity" }, ctx.user);
    return { data: null, error: "No Cloud OBS capacity is available right now. Please try again later." };
  }
  // Same rule as the page gate: an expired grant or a past_due plan is
  // read-only, so it can't start a new instance.
  if (!subscriptionId || !access.canInteract) {
    await track("cloud_obs_launch_failed", { reason: "no_subscription" }, ctx.user);
    return { data: null, error: "No active Cloud OBS subscription found." };
  }
  // The instance goes live with the user's Twitch stream key, which the node
  // fetches through rest-api. Without the scope that fetch returns nothing and
  // OBS boots keyless, so refuse here and let the page send them to Twitch.
  if (missingTwitchScopes(twitchScopes, "cloud_obs").length > 0) {
    await track("cloud_obs_launch_failed", { reason: "missing_twitch_scope" }, ctx.user);
    return { data: null, error: "Connect Twitch first so your cloud OBS can stream with your key." };
  }

  // Sent to the node in plaintext (it has to write it into OBS anyway).
  // rest-api encrypts it when the node stores the row; the node never sees
  // ciphertext or the encryption key.
  const obsWsPassword = randomUUID().replace(/-/g, "");

  // A 60-second token for this node and this one action, not the session.
  let token: string;
  try {
    token = await signNodeToken({ nodeId: node.id, userId, scope: "instances:create", role: "user" });
  } catch (err) {
    console.error("node token signing failed", err);
    return { data: null, error: "Couldn't reach Cloud OBS right now. Please try again later." };
  }

  const res = await fetch(`${node.api_url.replace(/\/$/, "")}/instances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...options,
      subscription_id: subscriptionId,
      obs_ws_password: obsWsPassword,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    await track("cloud_obs_launch_failed", { reason: "node_refused", status: res.status }, ctx.user);
    return { data: null, error: body.error ?? `Failed to launch instance (${res.status})` };
  }

  const instance = (await res.json()) as ObsInstance;
  await track("cloud_obs_launched", {}, ctx.user);
  return { data: { instance, apiUrl: node.api_url, password: obsWsPassword }, error: null };
}
