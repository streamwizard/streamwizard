import { redirect } from "next/navigation";
import { captureException } from "@sentry/nextjs";

// Supabase returns errors as values instead of throwing, so Next's
// onRequestError hook (see src/instrumentation.ts) never sees them — a bare
// `if (error) redirect("/error")` silently drops the only record of what
// went wrong. Funnel those paths through here so they're captured first.
// The console.error keeps a trail in server logs where Sentry is disabled
// (dev) or the event never arrives.
export function reportError(error: unknown, context: string): void {
  console.error(`[${context}]`, error);
  captureException(error, { tags: { context } });
}

// Returns never (redirect throws), so callers keep TypeScript's narrowing
// after `if (error) reportAndRedirect(...)` guards, same as a bare redirect.
export function reportAndRedirect(error: unknown, destination: string): never {
  reportError(error, destination);
  redirect(destination);
}
