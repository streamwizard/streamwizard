import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

export interface CloudObsPlanLimits {
  resolution: string;
  fps: number;
  max_instances: number;
  memory_mb: number;
  cpu_quota: number;
  shm_size: string;
  vram_mb: number;
}

export type ProductAccess = {
  canAccess: boolean;
  canInteract: boolean;
  status: string;
  plan: {
    id: string;
    name: string;
    limits: Record<string, unknown>;
  } | null;
};

export async function getPlanLimits(
  supabase: SupabaseClient<Database>,
  planId: string,
): Promise<CloudObsPlanLimits | null> {
  const { data } = await supabase.from("plans").select("limits").eq("id", planId).maybeSingle();
  if (!data) return null;
  return data.limits as unknown as CloudObsPlanLimits;
}

export async function getSubscriptionLimits(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<CloudObsPlanLimits | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("plans(limits)")
    .eq("id", subscriptionId)
    .in("status", ["active", "trialing", "past_due"])
    .maybeSingle();
  if (!data) return null;
  const plan = Array.isArray(data.plans) ? data.plans[0] : data.plans;
  if (!plan) return null;
  return plan.limits as unknown as CloudObsPlanLimits;
}

/** Returns the ID of the user's active subscription for the given product, or null. */
export async function getUserActiveSubscriptionId(
  supabase: SupabaseClient<Database>,
  userId: string,
  productId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("user_subscriptions")
    .select("id, plans!inner(product_id)")
    .eq("user_id", userId)
    .eq("plans.product_id", productId)
    .in("status", ["active", "trialing", "past_due"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function getProductAccess(
  supabase: SupabaseClient<Database>,
  productId: string
): Promise<ProductAccess> {
  const { data } = await supabase.rpc("get_product_access", { p_product_id: productId });

  const row = data?.[0];
  if (!row) {
    return { canAccess: false, canInteract: false, status: "none", plan: null };
  }

  return {
    canAccess: row.can_access ?? false,
    canInteract: row.can_interact ?? false,
    status: row.status ?? "none",
    plan: row.plan_id
      ? {
          id: row.plan_id,
          name: row.plan_name ?? "",
          limits: (row.limits as Record<string, unknown>) ?? {},
        }
      : null,
  };
}
