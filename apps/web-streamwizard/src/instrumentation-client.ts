import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";
import { initPostHog } from "@repo/posthog";

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

// Only init PostHog if the user has already accepted — no storage written before consent
if (process.env.NEXT_PUBLIC_POSTHOG_KEY && localStorage.getItem("sw_cookie_consent") === "accepted") {
  console.log("[posthog] consent found — initializing");
  initPostHog({
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
} else {
  console.log("[posthog] no consent yet — skipping init");
}

