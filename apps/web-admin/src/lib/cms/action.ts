import { reportError } from "@repo/sentry";
import { assertAdmin } from "@/lib/assert-admin";

// Shared plumbing for the Content section's server actions (blog posts,
// guides, authors, topics, media).

/** An error whose message is safe and useful to show in a toast. */
export class CmsError extends Error {}

export interface CmsActionResult {
  error: string | null;
}

/** Admin check for the top of every CMS action. Returns the admin's user id. */
export async function requireCmsAdmin(): Promise<string> {
  try {
    return await assertAdmin();
  } catch (error) {
    throw new CmsError(error instanceof Error ? error.message : "Not authorized");
  }
}

/** Toast-safe result for a caught error; unexpected ones go to Sentry. */
export function toCmsActionError(error: unknown, context: string, fallback: string): CmsActionResult {
  if (error instanceof CmsError) return { error: error.message };
  reportError(error, `web-admin cms: ${context}`);
  return { error: fallback };
}

/** Postgres unique_violation, as PostgREST reports it. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/** Postgres foreign_key_violation: the row is still referenced. */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
