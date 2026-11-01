import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import { isUserAdmin, listObsInstancesByUserOnNode, userHasInstanceOnNode } from "@repo/supabase/queries/obs-nodes";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions";
import { getStreamKeyForUser } from "./twitch-stream-key";

export async function listUserInstances(c: Context<Env, "/users/:userId/instances">) {
  const nodeId = c.get("nodeId");
  const userId = c.req.param("userId");
  // Only this node's instances for the user — a node has no business
  // enumerating a user's instances on other nodes.
  const instances = await listObsInstancesByUserOnNode(supabase, userId, nodeId);
  return c.json(instances);
}

// Not instance-scoped by design: the node manager's admin panel calls this to
// check whether an arbitrary logged-in user holds the platform admin role, so
// the caller may legitimately have no instance on this node. Only a boolean is
// disclosed, and the route is already behind node auth.
export async function getUserIsAdmin(c: Context<Env, "/users/:userId/is-admin">) {
  const userId = c.req.param("userId");
  const admin = await isUserAdmin(supabase, userId);
  return c.json({ is_admin: admin });
}

// Whether this user may start their Cloud OBS instance: an active or trialing
// plan whose period hasn't ended. The node asks before every user start, since
// the plan can be revoked after the instance was created. Checked by user and
// product, not the instance's subscription_id, which a regrant leaves stale.
// Like the stream key, only answered for users with an instance on this node.
export async function getCloudObsAccess(c: Context<Env, "/users/:userId/cloud-obs-access">) {
  const nodeId = c.get("nodeId");
  const userId = c.req.param("userId");
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) {
    return c.json({ error: "Forbidden" }, 403);
  }
  const subscriptionId = await getUserActiveSubscriptionId(supabase, userId, "cloud_obs");
  return c.json({ can_interact: subscriptionId !== null });
}

// Returns { key: string | null, reason }. See StreamKeyReason: the node
// refuses to boot on "scope_missing" / "no_integration" and boots keyless on
// "error" (OBS then shows its "Enter Stream Key" screen).
export async function getStreamKey(c: Context<Env, "/users/:userId/stream-key">) {
  const nodeId = c.get("nodeId");
  const userId = c.req.param("userId");

  // The stream key is a live broadcast credential. Only hand it to a node that
  // actually hosts an instance for this user — otherwise a single compromised
  // node key could enumerate every user's Twitch stream key. That only holds
  // because a row needs the user's own launch token (POST /instances).
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) {
    return c.json({ error: "Forbidden" }, 403);
  }

  return c.json(await getStreamKeyForUser(userId));
}
