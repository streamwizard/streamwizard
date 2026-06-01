import * as Sentry from "@sentry/bun";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    ...getSentryOptions({ dsn: process.env.SENTRY_DSN, service: "ws-server" }),
    integrations: [createSupabaseIntegration(Sentry)],
  });
  console.log("[sentry] active");
} else {
  console.log("[sentry] inactive (no SENTRY_DSN)");
}

export { Sentry };
