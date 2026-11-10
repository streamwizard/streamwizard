"use server";

import { z } from "zod";
import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";

import { BAD_INPUT, toActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdminContext, type AdminContext } from "@/lib/auth/admin-context";
import { actorIdentity, eventIdentity } from "@/lib/platform-events";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { logPlatformEvent } from "@repo/supabase/queries/platform/events";
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
  usersWithActiveSubscription,
} from "@repo/supabase/queries/subscriptions/subscriptions";
import { setIngestKeysActiveForUser } from "@repo/supabase/queries/ingest/ingest";
import { listRunningObsInstancesByUser, updateObsInstancesByUser } from "@repo/supabase/queries/obs-nodes/instances";
import { toggleInstanceAdminAction } from "@/actions/nodes/obs";
import { revalidatePath } from "next/cache";

// Product whose plans carry cloud-OBS resource limits + a config_template folder.
// IRL ingest is part of it too (web-streamwizard's INGEST_PRODUCT).
const CLOUD_OBS_PRODUCT_ID = "cloud_obs";

const SUBSCRIPTIONS_PATH = "/subscriptions";

/** The grants screen and every /users page, which show the same plans. */
function revalidateGrants() {
  revalidatePath(SUBSCRIPTIONS_PATH);
  revalidatePath("/users", "layout");
}

const GRANT_FAILED = "Couldn't grant the plan. Try again?";
const REVOKE_FAILED = "Couldn't revoke the plan. Try again?";
const UPDATE_FAILED = "Couldn't update the plan. Try again?";

// The dialogs send a date input's value ("2026-11-04"); "" or null means no expiry.
const expirySchema = z
  .union([z.iso.date(), z.iso.datetime({ offset: true }), z.literal("")])
  .nullable()
  .transform((value) => value || null);
const noteSchema = z
  .string()
  .max(1000)
  .nullable()
  .transform((value) => value || null);
const grantSchema = z.object({
  userId: guidSchema,
  // plans.id is a text key ("cloud_obs_basic"), not a uuid.
  planId: z.string().min(1).max(100),
  status: z.enum(["active", "trialing"]),
  expiresAt: expirySchema,
  note: noteSchema,
});
const updateSchema = z.object({
  subscriptionId: guidSchema,
  status: z.enum(["active", "trialing", "past_due"]),
  expiresAt: expirySchema,
  note: noteSchema,
});

/** Runs a grant change with the admin gate, input parse and catch-all every action here shares. */
async function runGrantChange<T>(
  schema: z.ZodType<T>,
  input: unknown,
  tag: string,
  fallback: string,
  run: (ctx: AdminContext, input: T) => Promise<ActionResult>,
): Promise<ActionResult> {
  try {
    const ctx = await requireAdminContext();
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { error: BAD_INPUT };
    return await run(ctx, parsed.data);
  } catch (error) {
    return toActionError(error, tag, fallback);
  }
}

export async function grantSubscriptionAction(
  userId: string,
  planId: string,
  status: "active" | "trialing",
  expiresAt: string | null,
  note: string | null,
): Promise<ActionResult> {
  return runGrantChange(grantSchema, { userId, planId, status, expiresAt, note }, "subscriptions.grant", GRANT_FAILED, grant);
}

async function grant(
  { adminClient, userId: adminUserId }: AdminContext,
  { userId, planId, status, expiresAt, note }: z.infer<typeof grantSchema>,
): Promise<ActionResult> {
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
    grant_note: note,
    current_period_end: expiresAt,
  });

  if (error) {
    reportError(error, "subscriptions.grant");
    return { error: GRANT_FAILED };
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
      reportError(e, "subscriptions.reapply-instances");
    }
    await applyCloudObsPlan(adminClient, userId);
  }

  revalidateGrants();
  return { error: null };
}

export async function revokeSubscriptionAction(subscriptionId: string): Promise<ActionResult> {
  return runGrantChange(guidSchema, subscriptionId, "subscriptions.revoke", REVOKE_FAILED, revoke);
}

async function revoke({ adminClient, userId: adminUserId }: AdminContext, subscriptionId: string): Promise<ActionResult> {
  const before = await loadSubscription(adminClient, subscriptionId);
  const { error } = await cancelSubscription(adminClient, subscriptionId);

  if (error) {
    reportError(error, "subscriptions.revoke");
    return { error: REVOKE_FAILED };
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
      "subscriptions.platform-event",
    );
  }

  if (before && firstPlan(before.plans)?.product_id === CLOUD_OBS_PRODUCT_ID) {
    await applyCloudObsPlan(adminClient, before.user_id);
  }

  revalidateGrants();
  return { error: null };
}

export async function updateSubscriptionAction(
  subscriptionId: string,
  updates: {
    status: "active" | "trialing" | "past_due";
    expiresAt: string | null;
    note: string | null;
  },
): Promise<ActionResult> {
  return runGrantChange(updateSchema, { subscriptionId, ...updates }, "subscriptions.update", UPDATE_FAILED, update);
}

async function update(
  { adminClient, userId: adminUserId }: AdminContext,
  { subscriptionId, ...updates }: z.infer<typeof updateSchema>,
): Promise<ActionResult> {
  const before = await loadSubscription(adminClient, subscriptionId);
  const { error } = await updateSubscriptionGrant(adminClient, subscriptionId, {
    status: updates.status,
    current_period_end: updates.expiresAt,
    grant_note: updates.note,
  });

  if (error) {
    reportError(error, "subscriptions.update");
    return { error: UPDATE_FAILED };
  }

  // The grant note is internal and can hold anything, so only status and
  // expiry changes are logged.
  if (before) {
    const changes: Record<string, { from: string | null; to: string | null }> = {};
    if (before.status !== updates.status) changes.status = { from: before.status, to: updates.status };
    const expiresAt = updates.expiresAt;
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
        "subscriptions.platform-event",
      );
    }
  }
  // past_due is read-only and an expiry in the past ends the plan, so either
  // can leave a running container or usable ingest keys without a plan behind
  // them. A change back to active turns the ingest keys on again.
  if (before && firstPlan(before.plans)?.product_id === CLOUD_OBS_PRODUCT_ID) {
    await applyCloudObsPlan(adminClient, before.user_id);
  }

  revalidateGrants();
  return { error: null };
}

// ── Cloud OBS containers and ingest keys on plan change (SW-478, SW-501) ─────

/**
 * Brings the user's Cloud OBS containers and IRL ingest keys in line with
 * their plan after a grant change (another active grant for the product
 * counts). Without a plan that may start things, running containers are
 * stopped and ingest keys are turned off, so a new ingest session is refused;
 * with one, ingest keys are turned back on. Keys are never deleted.
 * Best-effort: the subscription change already happened, and each node's plan
 * sweep stops containers this misses within a few minutes. A failed plan
 * lookup changes nothing.
 */
async function applyCloudObsPlan(client: AdminClient, userId: string) {
  let hasPlan: boolean;
  try {
    hasPlan = (await usersWithActiveSubscription(client, [userId], CLOUD_OBS_PRODUCT_ID)).has(userId);
  } catch (e) {
    reportError(e, "subscriptions.plan-lookup", { userId });
    return;
  }
  await Promise.all([hasPlan ? null : stopRunningInstances(client, userId), setIngestKeys(client, userId, hasPlan)]);
}

async function stopRunningInstances(client: AdminClient, userId: string) {
  try {
    const running = await listRunningObsInstancesByUser(client, userId);
    await Promise.all(
      running.map(async (instance) => {
        const { error } = await toggleInstanceAdminAction(instance.node_id, instance.id, "stop");
        if (error) reportError(new Error(error), "subscriptions.stop-instances");
      }),
    );
  } catch (e) {
    reportError(e, "subscriptions.stop-instances");
  }
}

async function setIngestKeys(client: AdminClient, userId: string, active: boolean) {
  try {
    const changed = await setIngestKeysActiveForUser(client, userId, active);
    if (changed.length > 0) {
      console.log(`[subscriptions] ingest keys turned ${active ? "on" : "off"}`, { userId, keys: changed.length });
    }
  } catch (e) {
    reportError(e, "subscriptions.ingest-keys", { userId, active });
  }
}

// ── Platform log (SW-334) ────────────────────────────────────────────────────

type AdminClient = AdminContext["adminClient"];

async function loadSubscription(client: AdminClient, subscriptionId: string) {
  try {
    return await getSubscriptionWithPlan(client, subscriptionId);
  } catch (e) {
    reportError(e, "subscriptions.load-for-log");
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
    reportError(e, "subscriptions.load-for-log");
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
    "subscriptions.platform-event",
  );
}
