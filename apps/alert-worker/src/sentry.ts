import * as Sentry from "@sentry/bun";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";

// Preloaded via `bun --preload ./src/sentry.ts` so the SDK is initialized
// before the engine loads. Shared code (@repo/alerting) reports through
// @sentry/core, which routes to this client.
if (process.env.SENTRY_DSN && process.env.NODE_ENV !== "development") {
  Sentry.init({
    ...getSentryOptions({ dsn: process.env.SENTRY_DSN, service: "alerter" }),
    integrations: [createSupabaseIntegration(Sentry)],
  });
  console.log("[sentry] active");
}

export { Sentry };
