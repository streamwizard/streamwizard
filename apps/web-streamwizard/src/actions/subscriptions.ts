"use server";

import { reportError } from "@repo/sentry";

import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { getPlanLimits } from "@repo/supabase/queries/subscriptions";
import { updateObsInstancesByUser } from "@repo/supabase/queries/obs-nodes";
import { revalidatePath } from "next/cache";

// Product whose plans carry cloud-OBS resource limits + a config_template folder.
const CLOUD_OBS_PRODUCT_ID = "cloud_obs";

const SUBSCRIPTIONS_PATH = "/dashboard/admin/subscriptions";

async function requireAdminContext() {
  const { user } = await getAuthContext();
  const adminClient = createAdminClient();
  const { data: roleRow } = await adminClient
    .from("user_roles")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) throw new Error("Forbidden");
  return { adminClient, adminUserId: user.id };
}

export async function grantSubscriptionAction(
  userId: string,
  planId: string,
  status: "active" | "trialing",
  expiresAt: string | null,
  note: string | null
) {
  const { adminClient, adminUserId } = await requireAdminContext();

  // Cancel any existing active subscriptions for the same product first
  const { data: planRow } = await adminClient
    .from("plans")
    .select("product_id")
    .eq("id", planId)
    .single();

  if (!planRow) return { error: "Plan not found" };

  // Find existing non-canceled subscriptions for this product
  const { data: existing } = await adminClient
    .from("user_subscriptions")
    .select("id, plan_id, plans!inner(product_id)")
    .eq("user_id", userId)
    .not("status", "in", "(canceled,inactive)");

  const toCancel = (existing ?? []).filter(
    (s) => (s.plans as { product_id: string }).product_id === planRow.product_id
  );

  if (toCancel.length > 0) {
    await adminClient
      .from("user_subscriptions")
      .update({ status: "canceled", updated_at: new Date().toISOString() })
      .in("id", toCancel.map((s) => s.id));
  }

  const { error } = await adminClient.from("user_subscriptions").upsert(
    {
      user_id: userId,
      plan_id: planId,
      status,
      granted_by: adminUserId,
      grant_note: note || null,
      current_period_end: expiresAt || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,plan_id" }
  );

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }

  // Re-apply the new plan to the user's existing cloud-OBS instances so an
  // upgrade/downgrade takes effect on their next start: the profile folder
  // (config_template) and the resource snapshot the resume path reads from the
  // row. A running instance keeps its current container until it next restarts.
  // Best-effort: the subscription is already granted, so a failure here is logged
  // but doesn't fail the action (instances still pick up the plan on next start).
  if (planRow.product_id === CLOUD_OBS_PRODUCT_ID) {
    try {
      const limits = await getPlanLimits(adminClient, planId);
      if (limits) {
        await updateObsInstancesByUser(adminClient, userId, {
          config_template: limits.config_template ?? null,
          resolution: limits.resolution,
          memory_mb: limits.memory_mb,
          cpu_quota: limits.cpu_quota,
          shm_size: limits.shm_size,
          // limits jsonb calls it vram_mb; the column is vram_allocated_mb.
          vram_allocated_mb: limits.vram_mb,
        });
      }
    } catch (e) {
      reportError(e, "actions/subscriptions:reapply-instances");
    }
  }

  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

export async function revokeSubscriptionAction(subscriptionId: string) {
  const { adminClient } = await requireAdminContext();

  const { error } = await adminClient
    .from("user_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  updates: {
    status: "active" | "trialing" | "past_due";
    expiresAt: string | null;
    note: string | null;
  }
) {
  const { adminClient } = await requireAdminContext();

  const { error } = await adminClient
    .from("user_subscriptions")
    .update({
      status: updates.status,
      current_period_end: updates.expiresAt || null,
      grant_note: updates.note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", subscriptionId);

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}
