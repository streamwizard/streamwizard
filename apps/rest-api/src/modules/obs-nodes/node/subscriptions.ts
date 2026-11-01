import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import { getSubscriptionLimits } from "@repo/supabase/queries/subscriptions";

// Returns the plan limits for an active subscription. Called by obs-instance-manager
// when provisioning a container so it can enforce subscription-defined resource
// allocations without needing direct Supabase access. Returns 404 if the
// subscription doesn't exist, is not active/trialing (past_due is read-only),
// or its paid period has ended.
export async function getPlanLimits(c: Context<Env, "/subscriptions/:subscriptionId/limits">) {
  const subscriptionId = c.req.param("subscriptionId");
  const limits = await getSubscriptionLimits(supabase, subscriptionId);
  if (!limits) return c.json({ error: "Subscription not found or inactive" }, 404);
  return c.json(limits);
}
