import { initPostHog } from "@repo/posthog";
import posthog from "posthog-js";

if (process.env.NODE_ENV !== "development") {
  import("@sentry/nextjs").then(async (Sentry) => {
    const { getSentryOptions, createSupabaseIntegration } = await import("@repo/sentry");
    Sentry.init({
      ...getSentryOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN!, service: "web-streamwizard" }),
      integrations: [
        Sentry.replayIntegration(),
        createSupabaseIntegration(Sentry),
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

if (process.env.NEXT_PUBLIC_POSTHOG_KEY) {
  initPostHog({
    key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}

