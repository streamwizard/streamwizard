import { getProductAccess, type ProductAccess } from "@repo/supabase/queries/subscriptions";

export const NO_CLOUD_OBS_PLAN = "Your Cloud OBS plan isn't active.";

// The same check as the page gate (requireProductAccess("cloud_obs")), for the
// server actions behind those pages. Without it a revoked user still holds the
// instance id from before and could keep reaching the node.
// canAccess: may see the instance (active, trialing, past_due).
// canInteract: may start or create one (active, trialing).
export function getCloudObsAccess(supabase: Parameters<typeof getProductAccess>[0]): Promise<ProductAccess> {
  return getProductAccess(supabase, "cloud_obs");
}
