import { reportError } from "@repo/sentry";

// What a server action or route handler tells the browser when something
// fails. Supabase, Helix and Zod error text stays on the server: it goes to
// Sentry, and the caller gets a short sentence we wrote.

/** An error whose message is written for the user and safe to show as is. */
export class ActionError extends Error {
  override name = "ActionError";
}

/**
 * The message to return for a caught error. An `ActionError` keeps its own
 * message; anything else is reported under `tag` and replaced by `fallback`.
 */
export function toActionError(
  error: unknown,
  tag: string,
  fallback: string,
  context?: Record<string, unknown>,
): string {
  if (error instanceof ActionError) return error.message;
  reportError(error, tag, context);
  return fallback;
}

/**
 * The first issue's message from a failed Zod parse: the hints our schemas
 * spell out ("Name is required"), never the JSON dump of `error.message`.
 */
export function zodErrorMessage(error: { issues: ReadonlyArray<{ message: string }> }, fallback: string): string {
  return error.issues[0]?.message ?? fallback;
}
