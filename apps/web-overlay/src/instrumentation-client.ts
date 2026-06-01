import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";

Sentry.init({
  ...getSentryOptions({ dsn: process.env.NEXT_PUBLIC_SENTRY_DSN!, service: "web-overlay" }),
  integrations: [createSupabaseIntegration(Sentry)],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
