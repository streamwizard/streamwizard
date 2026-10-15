import { reportError } from "@repo/sentry";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { queueCmsRevalidation } from "@repo/supabase/queries/cms/schedule";
import { env } from "@/lib/env";

// Server-only. Tells web-streamwizard which cached pages a change touched
// (POST /api/revalidate there). Best effort: a failed refresh never fails the
// admin's save. It goes into cms_revalidate_queue for the rest-api scheduler
// to retry, and every cached CMS read expires within an hour anyway.

const TIMEOUT_MS = 5_000;

export type RevalidateMode = "stale" | "immediate";

export interface RevalidateOptions {
  /** Public pages that changed, for IndexNow (the site pings on production only). */
  indexNow?: string[];
}

/** True when the site confirmed the refresh, or when there is no site to tell (local dev). */
export async function revalidateCms(
  tags: string[],
  mode: RevalidateMode = "stale",
  options: RevalidateOptions = {},
): Promise<boolean> {
  if (tags.length === 0) return true;
  if (!env.CMS_SITE_URL || !env.CMS_REVALIDATE_SECRET) return true;
  const indexNow = options.indexNow ?? [];
  try {
    const response = await fetch(new URL("/api/revalidate", env.CMS_SITE_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${env.CMS_REVALIDATE_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ tags, mode, ...(indexNow.length ? { indexNow } : {}) }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.ok) return true;
    await queueRetry(tags, mode, indexNow, new Error(`revalidate answered ${response.status}`));
    return false;
  } catch (error) {
    await queueRetry(tags, mode, indexNow, error);
    return false;
  }
}

async function queueRetry(tags: string[], mode: RevalidateMode, indexNow: string[], cause: unknown) {
  const { error } = await queueCmsRevalidation(supabaseAdmin, { tags, mode, indexNowPaths: indexNow });
  // Only worth a Sentry event when it can't even be retried.
  if (error) reportError(cause, "web-admin cms: revalidate", { queueError: error.message });
  else console.warn("[cms] revalidate failed, queued for retry:", cause instanceof Error ? cause.message : cause);
}
