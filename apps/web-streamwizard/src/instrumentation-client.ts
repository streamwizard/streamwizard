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

if (process.env.NODE_ENV !== "development") {
  import("@sentry/nextjs").then(async (Sentry) => {
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
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
    });
  });
}

export async function onRouterTransitionStart(...args: unknown[]) {
  if (process.env.NODE_ENV === "development") return;
  const { captureRouterTransitionStart } = await import("@sentry/nextjs");
  return (captureRouterTransitionStart as (...a: unknown[]) => unknown)(...args);
}
