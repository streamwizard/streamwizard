import type { z } from "zod";
import { ActionError, BAD_INPUT, errorTag, toActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";
import { classifyContentError } from "@/lib/cms/publish/content-errors";

// Shared plumbing for the Content section's server actions (blog posts,
// guides, authors, topics, media).

/** An error whose message is safe and useful to show in a toast. */
export class CmsError extends ActionError {}

export type CmsActionResult = ActionResult;

/** Admin check for the top of every CMS action. Returns the admin's user id. */
export async function requireCmsAdmin(): Promise<string> {
  return requireAdmin();
}

/**
 * Parses an action's arguments, right after requireCmsAdmin() and before any
 * other lookup. A failure throws a CmsError with the schema's own message for
 * the first issue, or `fallback` where the schema has none, so Zod's wording
 * never reaches the toast.
 */
export function parseCmsInput<S extends z.ZodType>(schema: S, input: unknown, fallback: string = BAD_INPUT): z.output<S> {
  const parsed = schema.safeParse(input, { error: () => fallback });
  if (!parsed.success) throw new CmsError(parsed.error.issues[0]?.message ?? fallback);
  return parsed.data;
}

/** Toast-safe result for a caught error; unexpected ones go to Sentry. */
export function toCmsActionError(error: unknown, context: string, fallback: string): CmsActionResult {
  return toActionError(error, errorTag("cms", context), fallback);
}

/**
 * Rethrows what a CMS database function raised: a lock conflict, a missing
 * row or a known check as a CmsError in `messages`' words, anything else as is
 * (toCmsActionError reports it).
 */
export function throwContentError(error: unknown, messages: { conflict: string; notFound: string }): never {
  const failure = classifyContentError(error);
  if (failure.kind === "conflict") throw new CmsError(messages.conflict);
  if (failure.kind === "not_found") throw new CmsError(messages.notFound);
  if (failure.kind === "message") throw new CmsError(failure.message);
  throw error;
}

/** Postgres unique_violation, as PostgREST reports it. */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}

/** Postgres foreign_key_violation: the row is still referenced. */
export function isForeignKeyViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23503";
}
