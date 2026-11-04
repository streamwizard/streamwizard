import { reportError } from "@repo/sentry";

// Shared plumbing for every server action's error path. An action never
// throws to the client: it returns `{ error }`, where `error` is a short
// sentence the admin can act on.

/** An error whose message is safe and useful to show in a toast. The section
 * errors (`CmsError`, `DashboardError`) extend it. */
export class ActionError extends Error {}

export interface ActionResult {
  error: string | null;
}

/** The `{ data, error }` shape of an action that returns something. */
export interface DataResult<T> {
  data: T | null;
  error: string | null;
}

/** Shown when an action's input doesn't parse. Only our own UI calls these
 * actions, so bad input means a stale page or a hand-made request. */
export const BAD_INPUT = "That request doesn't look right. Reload the page and try again.";

/** Toast-safe result for a caught error: an ActionError keeps its message,
 * anything else goes to Sentry under `tag` and becomes `fallback`. */
export function toActionError(
  error: unknown,
  tag: string,
  fallback: string,
  context?: Record<string, unknown>,
): ActionResult {
  if (error instanceof ActionError) return { error: error.message };
  reportError(error, tag, context);
  return { error: fallback };
}

/** toActionError() for an action that answers `{ data, error }`. */
export function toDataError(
  error: unknown,
  tag: string,
  fallback: string,
  context?: Record<string, unknown>,
): DataResult<never> {
  return { data: null, ...toActionError(error, tag, fallback, context) };
}

/** "save ticket panel" → "save-ticket-panel", for `<area>.<action>` tags. */
export function errorTag(area: string, action: string): string {
  return `${area}.${action.trim().toLowerCase().replace(/\s+/g, "-")}`;
}
