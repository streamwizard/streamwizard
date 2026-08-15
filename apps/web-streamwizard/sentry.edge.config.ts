import * as Sentry from "@sentry/nextjs";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";

Sentry.init({
  ...getSentryOptions({ dsn: process.env.SENTRY_DSN_WEB_STREAMWIZARD || process.env.SENTRY_DSN!, service: "web-streamwizard" }),
  integrations: [createSupabaseIntegration(Sentry)],
});
