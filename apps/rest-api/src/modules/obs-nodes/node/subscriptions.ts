import type { Context, Env } from "hono";
import { supabase } from "@repo/supabase";
import { getSubscriptionLimits } from "@repo/supabase/queries/subscriptions";
import { parseUuid } from "@/schemas/nodes-shared";

// Returns the plan limits for an active subscription. Called by obs-instance-manager
// when provisioning a container so it can enforce subscription-defined resource
// allocations without needing direct Supabase access. Returns 404 if the
// subscription doesn't exist, is not a Cloud OBS plan, is not active/trialing
// (past_due is read-only), or its paid period has ended.
export async function getPlanLimits(c: Context<Env, "/subscriptions/:subscriptionId/limits">) {
  const subscriptionId = parseUuid(c.req.param("subscriptionId"));
  if (!subscriptionId) return c.json({ error: "Subscription not found or inactive" }, 404);
  const limits = await getSubscriptionLimits(supabase, subscriptionId, "cloud_obs");
  if (!limits) return c.json({ error: "Subscription not found or inactive" }, 404);
  return c.json(limits);
}
