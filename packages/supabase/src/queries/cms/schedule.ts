import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../types/supabase";
import { withMetrics } from "../with-metrics";

/**
 * Scheduled publishing and the cache-refresh retry queue. Service-role only:
 * web-admin schedules and queues failed refreshes, the rest-api scheduler
 * publishes due posts and works the queue.
 */

type DBClient = SupabaseClient<Database>;
export type CmsRevalidation = Database["public"]["Tables"]["cms_revalidate_queue"]["Row"];

/** Schedule a draft, or move a scheduled post to a new time. Returns { lock_version, publish_at }. */
export const scheduleCmsContent = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number, publishAt: string) =>
    client.rpc("cms_schedule", {
      p_content_id: contentId,
      p_actor: actorId,
      p_expected_lock_version: expectedLockVersion,
      p_publish_at: publishAt,
    }),
);

/** Back to a draft. Returns { lock_version }. */
export const unscheduleCmsContent = withMetrics(
  "cms_content",
  "update",
  async (client: DBClient, contentId: string, actorId: string, expectedLockVersion: number) =>
    client.rpc("cms_unschedule", {
      p_content_id: contentId,
      p_actor: actorId,
      p_expected_lock_version: expectedLockVersion,
    }),
);

/** Publishes every scheduled post that is due, one row per post (ok, result or error). */
export const claimDueCmsScheduled = withMetrics("cms_content", "update", async (client: DBClient, limit: number) =>
  client.rpc("cms_claim_due_scheduled", { p_limit: limit }),
);

export interface QueueCmsRevalidationInput {
  tags: string[];
  mode: "stale" | "immediate";
  indexNowPaths?: string[];
}

/** A refresh the site didn't confirm, for the scheduler to retry. */
export const queueCmsRevalidation = withMetrics(
  "cms_revalidate_queue",
  "insert",
  async (client: DBClient, input: QueueCmsRevalidationInput) =>
    client
      .from("cms_revalidate_queue")
      .insert({ tags: input.tags, mode: input.mode, index_now_paths: input.indexNowPaths ?? [] }),
);

/** Up to `limit` due retries, leased for `leaseSeconds`. */
export const claimCmsRevalidations = withMetrics(
  "cms_revalidate_queue",
  "update",
  async (client: DBClient, limit: number, leaseSeconds: number) =>
    client.rpc("cms_claim_revalidations", { p_limit: limit, p_lease_seconds: leaseSeconds }),
);

export const deleteCmsRevalidation = withMetrics(
  "cms_revalidate_queue",
  "delete",
  async (client: DBClient, id: number) => client.from("cms_revalidate_queue").delete().eq("id", id),
);

export const retryCmsRevalidationAt = withMetrics(
  "cms_revalidate_queue",
  "update",
  async (client: DBClient, id: number, nextAttemptAt: string, lastError: string) =>
    client.from("cms_revalidate_queue").update({ next_attempt_at: nextAttemptAt, last_error: lastError }).eq("id", id),
);
