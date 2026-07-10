import * as Sentry from "@sentry/bun";
import { getSentryOptions } from "@repo/sentry";

if (process.env.SENTRY_DSN && process.env.NODE_ENV !== "development") {
  Sentry.init(getSentryOptions({ dsn: process.env.SENTRY_DSN, service: "discord-bot" }));
  console.log("[sentry] active");
} else {
  console.log("[sentry] inactive (no SENTRY_DSN)");
}

export { Sentry };
