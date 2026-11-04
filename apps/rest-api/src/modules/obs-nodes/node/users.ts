import { supabase } from "@repo/supabase";
import { listObsInstancesByUserOnNode, userHasInstanceOnNode } from "@repo/supabase/queries/obs-nodes/instances";
import { isUserAdmin } from "@repo/supabase/queries/auth/roles";
import { getUserActiveSubscriptionId } from "@repo/supabase/queries/subscriptions/subscriptions";

export function listUserInstances(nodeId: string, userId: string) {
  // Only this node's instances for the user — a node has no business
  // enumerating a user's instances on other nodes.
  return listObsInstancesByUserOnNode(supabase, userId, nodeId);
}

// Not instance-scoped by design: the node manager's admin panel calls this to
// check whether an arbitrary logged-in user holds the platform admin role, so
// the caller may legitimately have no instance on this node. Only a boolean is
// disclosed, and the route is already behind node auth.
export function getUserIsAdmin(userId: string): Promise<boolean> {
  return isUserAdmin(supabase, userId);
}

// Whether this user may start their Cloud OBS instance: an active or trialing
// plan whose period hasn't ended. The node asks before every user start, since
// the plan can be revoked after the instance was created. Checked by user and
// product, not the instance's subscription_id, which a regrant leaves stale.
// Like the stream key, only answered for users with an instance on this node:
// null when the user has none here.
export async function getCloudObsAccess(nodeId: string, userId: string): Promise<{ canInteract: boolean } | null> {
  if (!(await userHasInstanceOnNode(supabase, userId, nodeId))) return null;
  const subscriptionId = await getUserActiveSubscriptionId(supabase, userId, "cloud_obs");
  return { canInteract: subscriptionId !== null };
}
