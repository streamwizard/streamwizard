import { createHash, timingSafeEqual } from "node:crypto";
import { isCmsTag, isContentPath } from "@repo/cms";
import { z } from "zod";

// The logic behind POST /api/revalidate, without Next in the way so it can be
// tested. web-admin (on publish, update, unpublish) and the rest-api CMS
// scheduler call it with the cache tags a change touched; see
// tagsForChange in @repo/cms.

const MAX_BODY_BYTES = 16 * 1024;
const MAX_TAGS = 200;

// "stale": the next visitor still gets the old copy while a fresh one renders
// (publish, update). "immediate": the old copy is never served again
// (unpublish, archive, delete), so removed content can't linger.
export type RevalidateMode = "stale" | "immediate";

const MAX_INDEX_NOW_PATHS = 20;

const bodySchema = z.object({
  tags: z.array(z.string()).min(1).max(MAX_TAGS),
  mode: z.enum(["stale", "immediate"]).default("stale"),
  // Public pages that changed, for IndexNow: /blog, /guides or a post under them.
  indexNow: z.array(z.string()).max(MAX_INDEX_NOW_PATHS).default([]),
});

export interface RevalidateDeps {
  // CMS_REVALIDATE_SECRET. Unset means the endpoint doesn't exist.
  secret: string | undefined;
  revalidate: (tag: string, mode: RevalidateMode) => void;
  // Runs after the response; the production host only (lib/indexnow.ts).
  pingIndexNow?: (paths: string[]) => void;
}

export interface RevalidateResult {
  status: number;
  body: { error: string } | { revalidated: number };
}

// Hashed first so both sides are the same length and timingSafeEqual can't
// leak the expected length by throwing.
export function secretsMatch(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export async function handleRevalidate(request: Request, deps: RevalidateDeps): Promise<RevalidateResult> {
  if (!deps.secret) return { status: 404, body: { error: "Not found" } };

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!secretsMatch(token, deps.secret)) return { status: 401, body: { error: "Unauthorized" } };

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return { status: 413, body: { error: "Body too large" } };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: 400, body: { error: "Body must be JSON" } };
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success)
    return {
      status: 400,
      body: { error: "Expected { tags: string[], mode?: 'stale' | 'immediate', indexNow?: string[] }" },
    };

  // All or nothing: one bad tag means a caller bug, and a half-applied
  // refresh is harder to reason about than a refused one.
  const unknown = parsed.data.tags.filter((tag) => !isCmsTag(tag));
  if (unknown.length > 0)
    return { status: 400, body: { error: `Not a CMS cache tag: ${unknown.slice(0, 3).join(", ")}` } };

  const badPaths = parsed.data.indexNow.filter((path) => !isContentPath(path));
  if (badPaths.length > 0)
    return { status: 400, body: { error: `Not a blog or guide path: ${badPaths.slice(0, 3).join(", ")}` } };

  const tags = [...new Set(parsed.data.tags)];
  for (const tag of tags) deps.revalidate(tag, parsed.data.mode);
  const paths = [...new Set(parsed.data.indexNow)];
  if (paths.length > 0) deps.pingIndexNow?.(paths);
  return { status: 200, body: { revalidated: tags.length } };
}
