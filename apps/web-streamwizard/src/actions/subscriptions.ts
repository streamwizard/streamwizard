"use server";

import { getAuthContext } from "@/lib/auth";
import { createAdminClient } from "@repo/supabase/next/admin";
import { revalidatePath } from "next/cache";

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

  if (error) return { error: error.message };
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

export async function revokeSubscriptionAction(subscriptionId: string) {
  const { adminClient } = await requireAdminContext();

  const { error } = await adminClient
    .from("user_subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("id", subscriptionId);

  if (error) return { error: error.message };
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

  if (error) return { error: error.message };
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}
