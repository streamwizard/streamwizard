import { reportError } from "@repo/sentry";
import { env } from "@/lib/env";

// Server-only. Tells web-streamwizard which cached pages a change touched
// (POST /api/revalidate there). Best effort: a failed refresh never fails the
// admin's save, and every cached CMS read expires within an hour anyway.

const TIMEOUT_MS = 5_000;

export type RevalidateMode = "stale" | "immediate";

/** True when the site confirmed the refresh, or when there is no site to tell (local dev). */
export async function revalidateCms(tags: string[], mode: RevalidateMode = "stale"): Promise<boolean> {
  if (tags.length === 0) return true;
  if (!env.CMS_REVALIDATE_URL || !env.CMS_REVALIDATE_SECRET) return true;
  try {
    const response = await fetch(new URL("/api/revalidate", env.CMS_REVALIDATE_URL), {
      method: "POST",
      headers: { authorization: `Bearer ${env.CMS_REVALIDATE_SECRET}`, "content-type": "application/json" },
      body: JSON.stringify({ tags, mode }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    if (response.ok) return true;
    reportError(new Error(`revalidate answered ${response.status}`), "web-admin cms: revalidate");
    return false;
  } catch (error) {
    reportError(error, "web-admin cms: revalidate");
    return false;
  }
}
