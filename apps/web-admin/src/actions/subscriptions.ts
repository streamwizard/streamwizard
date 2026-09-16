"use server";

import { reportError } from "@repo/sentry";

import { assertAdmin } from "@/lib/assert-admin";
import { actorIdentity, eventIdentity } from "@/lib/platform-events";
import { createAdminClient, supabaseAdmin } from "@repo/supabase/next/admin";
import { logPlatformEvent } from "@repo/supabase/queries/platform-events";
import {
  cancelSubscription,
  cancelSubscriptions,
  getLiveSubscriptionsForUser,
  getPlanLimits,
  getPlanProductId,
  getPlanWithProduct,
  getSubscriptionWithPlan,
  updateSubscriptionGrant,
  upsertSubscriptionGrant,
} from "@repo/supabase/queries/subscriptions";
import { updateObsInstancesByUser } from "@repo/supabase/queries/obs-nodes";
import { revalidatePath } from "next/cache";

// Product whose plans carry cloud-OBS resource limits + a config_template folder.
const CLOUD_OBS_PRODUCT_ID = "cloud_obs";

const SUBSCRIPTIONS_PATH = "/subscriptions";

async function requireAdminContext() {
  const adminUserId = await assertAdmin();
  return { adminClient: createAdminClient(), adminUserId };
}

export async function grantSubscriptionAction(
  userId: string,
  planId: string,
  status: "active" | "trialing",
  expiresAt: string | null,
  note: string | null,
) {
  const { adminClient, adminUserId } = await requireAdminContext();

  // Cancel any existing active subscriptions for the same product first
  const productId = await getPlanProductId(adminClient, planId);
  if (!productId) return { error: "Plan not found" };

  const { data: existing } = await getLiveSubscriptionsForUser(adminClient, userId);
  const toCancel = (existing ?? []).filter((s) => (s.plans as { product_id: string }).product_id === productId);

  if (toCancel.length > 0) {
    await cancelSubscriptions(
      adminClient,
      toCancel.map((s) => s.id),
    );
  }

  const { error } = await upsertSubscriptionGrant(adminClient, {
    user_id: userId,
    plan_id: planId,
    status,
    granted_by: adminUserId,
    grant_note: note || null,
    current_period_end: expiresAt || null,
  });

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }

  await logGrant(adminClient, { userId, planId, productId, status, expiresAt, adminUserId, toCancel });

  // Re-apply the new plan to the user's existing cloud-OBS instances so an
  // upgrade/downgrade takes effect on their next start: the profile folder
  // (config_template) and the resource snapshot the resume path reads from the
  // row. A running instance keeps its current container until it next restarts.
  // Best-effort: the subscription is already granted, so a failure here is logged
  // but doesn't fail the action (instances still pick up the plan on next start).
  if (productId === CLOUD_OBS_PRODUCT_ID) {
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
  const { adminClient, adminUserId } = await requireAdminContext();

  const before = await loadSubscription(adminClient, subscriptionId);
  const { error } = await cancelSubscription(adminClient, subscriptionId);

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }

  if (before && before.status !== "canceled") {
    const plan = firstPlan(before.plans);
    const [identity, actor] = await Promise.all([eventIdentity(before.user_id), actorIdentity(adminUserId)]);
    await logPlatformEvent(
      supabaseAdmin,
      {
        type: "subscription.revoked",
        subjectUserId: before.user_id,
        actorUserId: adminUserId,
        payload: {
          ...identity,
          ...actor,
          subscription_id: subscriptionId,
          product_id: plan?.product_id ?? "",
          plan_id: before.plan_id,
          plan_name: plan?.name ?? null,
          status: "canceled",
          expires_at: before.current_period_end,
        },
      },
      "web-admin subscriptions",
    );
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
  },
) {
  const { adminClient, adminUserId } = await requireAdminContext();

  const before = await loadSubscription(adminClient, subscriptionId);
  const { error } = await updateSubscriptionGrant(adminClient, subscriptionId, {
    status: updates.status,
    current_period_end: updates.expiresAt || null,
    grant_note: updates.note || null,
  });

  if (error) {
    reportError(error, "actions/subscriptions");
    return { error: error.message };
  }

  // The grant note is internal and can hold anything, so only status and
  // expiry changes are logged.
  if (before) {
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    if (before.status !== updates.status) changes.status = { from: before.status, to: updates.status };
    const expiresAt = updates.expiresAt || null;
    if (!sameInstant(before.current_period_end, expiresAt)) {
      changes.expires_at = { from: before.current_period_end, to: expiresAt };
    }
    if (Object.keys(changes).length > 0) {
      const plan = firstPlan(before.plans);
      const [identity, actor] = await Promise.all([eventIdentity(before.user_id), actorIdentity(adminUserId)]);
      await logPlatformEvent(
        supabaseAdmin,
        {
          type: "subscription.changed",
          subjectUserId: before.user_id,
          actorUserId: adminUserId,
          payload: {
            ...identity,
            ...actor,
            subscription_id: subscriptionId,
            product_id: plan?.product_id ?? "",
            plan_id: before.plan_id,
            plan_name: plan?.name ?? null,
            status: updates.status,
            expires_at: expiresAt,
            changes,
          },
        },
        "web-admin subscriptions",
      );
    }
  }
  revalidatePath(SUBSCRIPTIONS_PATH);
  return { error: null };
}

// ── Platform log (SW-334) ────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

async function loadSubscription(client: AdminClient, subscriptionId: string) {
  try {
    return await getSubscriptionWithPlan(client, subscriptionId);
  } catch (e) {
    reportError(e, "actions/subscriptions:load-for-log");
    return null;
  }
}

function firstPlan<T>(plans: T | T[] | null): T | null {
  return Array.isArray(plans) ? (plans[0] ?? null) : plans;
}

function sameInstant(a: string | null, b: string | null): boolean {
  if (!a || !b) return a === b;
  return new Date(a).getTime() === new Date(b).getTime();
}

async function logGrant(
  client: AdminClient,
  grant: {
    userId: string;
    planId: string;
    productId: string;
    status: "active" | "trialing";
    expiresAt: string | null;
    adminUserId: string;
    toCancel: { plan_id: string }[];
  },
) {
  let planName: string | null = null;
  try {
    planName = (await getPlanWithProduct(client, grant.planId))?.name ?? null;
  } catch (e) {
    reportError(e, "actions/subscriptions:load-for-log");
  }
  const [identity, actor] = await Promise.all([eventIdentity(grant.userId), actorIdentity(grant.adminUserId)]);
  await logPlatformEvent(
    supabaseAdmin,
    {
      type: "subscription.granted",
      subjectUserId: grant.userId,
      actorUserId: grant.adminUserId,
      payload: {
        ...identity,
        ...actor,
        product_id: grant.productId,
        plan_id: grant.planId,
        plan_name: planName,
        status: grant.status,
        expires_at: grant.expiresAt || null,
        replaced_plan_ids: grant.toCancel.map((s) => s.plan_id).filter((id) => id !== grant.planId),
      },
    },
    "web-admin subscriptions",
  );
}
