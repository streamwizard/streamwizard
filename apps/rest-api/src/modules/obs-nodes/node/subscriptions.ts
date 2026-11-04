import { supabase } from "@repo/supabase";
import { getSubscriptionLimits } from "@repo/supabase/queries/subscriptions";

// Returns the plan limits for an active subscription. Called by obs-instance-manager
// when provisioning a container so it can enforce subscription-defined resource
// allocations without needing direct Supabase access. Returns null if the
// subscription doesn't exist, is not a Cloud OBS plan, is not active/trialing (past_due is read-only),
// or its paid period has ended.
export function getPlanLimits(subscriptionId: string) {
  return getSubscriptionLimits(supabase, subscriptionId, "cloud_obs");
}
