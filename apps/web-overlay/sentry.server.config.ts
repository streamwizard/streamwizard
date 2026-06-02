import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";

Sentry.init({
  ...getSentryOptions({ dsn: process.env.SENTRY_DSN!, service: "web-overlay" }),
  integrations: [createSupabaseIntegration(Sentry)],
});
