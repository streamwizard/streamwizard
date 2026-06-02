import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";
import { initPostHog } from "@repo/posthog";
import posthog from "posthog-js";

Sentry.init({
  ...getSentryOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN!, service: "web-streamwizard" }),
  integrations: [
    Sentry.replayIntegration(),
    createSupabaseIntegration(Sentry),
  ],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

// Re-hydrate PostHog on page load when the user has previously accepted consent.
// initPostHog sets opt_out_capturing_by_default:true, so we must also call
// opt_in_capturing() to restore the active state — without it tracking stays dead.
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && localStorage.getItem("sw_cookie_consent") === "accepted") {
  initPostHog({
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
  posthog.opt_in_capturing();
}

