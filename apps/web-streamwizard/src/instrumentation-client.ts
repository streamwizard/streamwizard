import { hasGrantedConsent, initPostHog } from "@repo/posthog";

// Dev gets no analytics (same as Sentry below): the dev Doppler configs carry
// the staging key, so localhost sessions would pollute the staging project —
// local supabase resets mint fresh user ids and fragment person profiles.
//
// PostHog goes first because the Sentry block reads the stored consent choice.
if (process.env.NODE_ENV !== "development" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  initPostHog({
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}

// Sentry waits until the browser is idle. Its chunk (SDK plus supabase-js for
// the Supabase integration) is ~750 KB of script, and loading it at module time
// competed with the first paint and hydration on every page. Errors thrown in
// the first moment of a page load are missed; the timeout caps that window.
// A visitor who accepts cookies before this runs still gets Replay, because the
// consent check below happens at init.
function whenIdle(fn: () => void) {
  if ("requestIdleCallback" in window) requestIdleCallback(fn, { timeout: 3000 });
  else setTimeout(fn, 1500);
}

if (process.env.NODE_ENV !== "development") {
  whenIdle(() => void import("@sentry/nextjs").then(async (Sentry) => {
    const { getSentryOptions, createSupabaseIntegration, createConsoleLogsIntegration } =
      await import("@repo/sentry");
    Sentry.init({
      ...getSentryOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN!, service: "web-streamwizard" }),
      integrations: [
        // Replay only for visitors who accepted analytics; the cookie banner
        // adds it at runtime for everyone else who accepts later. See
        // src/lib/sentry-replay.ts.
        ...(hasGrantedConsent() ? [Sentry.replayIntegration()] : []),
        createSupabaseIntegration(Sentry),
        createConsoleLogsIntegration(),
      ],
      // Only sessions that hit an error. PostHog records the ordinary ones now
      // (see packages/posthog/src/init.ts), and two recorders on one page is
      // twice the work for the visitor's browser.
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 1.0,
    });
  }));
}

export async function onRouterTransitionStart(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") return;
  const { captureRouterTransitionStart } = await import("@sentry/nextjs");
  return (captureRouterTransitionStart as (...a: unknown[]) => unknown)(...args);
}
