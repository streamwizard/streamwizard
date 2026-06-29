import { Sentry } from "./sentry";
process.on("uncaughtException", (err) => { Sentry.captureException(err); });
process.on("unhandledRejection", (reason) => { Sentry.captureException(reason); });
import { env } from "./lib/env";
import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";
import { getSentryOptions, createSupabaseIntegration } from "@repo/sentry";
import { metricsMiddleware, isMetricsEnabled } from "@repo/metrics";
import { internalAuth } from "./middleware/internal-auth";
import { authorizeHandler } from "./routes/authorize";
import { sessionEndHandler } from "./routes/session-end";
import { sessionStatsHandler, getSessionStatsHandler, startSessionStatsFlusher } from "./routes/session-stats";
import { wsBroadcastClient } from "./lib/ws-broadcast";

const app = new Hono();

if (env.SENTRY_DSN && env.NODE_ENV !== "development") {
  app.use("*", sentry(app, {
    ...getSentryOptions({ dsn: env.SENTRY_DSN, service: "ingest-control" }),
    integrations: [createSupabaseIntegration(Sentry)],
  }));
  console.log("[sentry] active");
} else {
  console.log("[sentry] inactive (no SENTRY_DSN)");
}

app.use("*", metricsMiddleware("ingest-control"));

app.get("/", (c) => c.json({ message: "StreamWizard Ingest Control", version: "1.0.0" }));

// Internal control-plane API — only the media plane calls these, guarded by the
// shared secret and only reachable on the private compose network.
app.use("/internal/*", internalAuth);
app.post("/internal/authorize", authorizeHandler);
app.post("/internal/session-end", sessionEndHandler);
app.post("/internal/session-stats", sessionStatsHandler);
app.get("/internal/session-stats/:sessionId", getSessionStatsHandler);

startSessionStatsFlusher();
wsBroadcastClient.connect();

Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
});

console.log(`[ingest-control] listening on port ${env.PORT}`);
console.log(`[metrics] ${isMetricsEnabled() ? "active — sending to " + process.env.INFLUXDB_URL : "disabled — set INFLUXDB_* env vars to enable"}`);
