import { revalidateTag } from "next/cache";
import { after, NextResponse } from "next/server";
import { reportError } from "@repo/sentry";
import { handleRevalidate } from "@/lib/cms-revalidate";
import { env } from "@/lib/env";
import { pingIndexNow } from "@/lib/indexnow";

/**
 * POST /api/revalidate: server-to-server only. web-admin and the rest-api CMS
 * scheduler send `Authorization: Bearer <CMS_REVALIDATE_SECRET>` and
 * `{ tags, mode, indexNow? }` after a post changes. See lib/cms-revalidate.ts.
 *
 * One container serves the site today, so refreshing this instance's cache is
 * refreshing the site. A second replica would need a shared cache handler.
 */
export async function POST(request: Request) {
  try {
    const result = await handleRevalidate(request, {
      secret: env.CMS_REVALIDATE_SECRET,
      revalidate: (tag, mode) => revalidateTag(tag, mode === "immediate" ? { expire: 0 } : "max"),
      // After the response: the caller only waits for the cache refresh.
      pingIndexNow: (paths) => after(() => pingIndexNow(paths)),
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    reportError(error, "cms: revalidate");
    return NextResponse.json({ error: "Revalidation failed" }, { status: 500 });
  }
}
