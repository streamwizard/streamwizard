import { Hono } from "hono";
import { sentry } from "@sentry/hono/bun";
import { createConsoleLogsIntegration, createSupabaseIntegration, getSentryOptions } from "@repo/sentry";
import { metricsMiddleware } from "@repo/metrics";
import { cors } from "hono/cors";
import { Sentry } from "@/sentry";
import { env } from "@/env";
import { createApiErrorHandler } from "@/middleware/error-handler";
import { securityMiddleware } from "@/middleware/security";
import { supabaseMiddleware } from "@/middleware/auth";
import { obsNodeAuthCacheStats } from "@/middleware/obs-node-auth";
import { ingestNodeAuthCacheStats } from "@/middleware/ingest-node-auth";
import { eventsubRoutes } from "@/modules/eventsub/routes";
import { ingestNodeRoutes } from "@/modules/ingest-nodes/routes";
import { obsNodeRoutes } from "@/modules/obs-nodes/routes";
import { clipSyncRoutes } from "@/modules/streams/routes";
import { internalBackups, proxmoxWebhook } from "@/routes/backups";

/**
 * Builds the Hono app: the middleware chain and every module's routes, in the
 * order they must run. Starts nothing; index.ts serves what this returns.
 */
export function createApp(): Hono {
  const app = new Hono();

  // Liveness probe for the monitoring alert-worker — registered before every
  // middleware so probe traffic never hits Sentry tracing or http_request
  // metrics.
  //
  // The auth cache stats ride along: those caches are what keeps the node
  // agents' poll loop off Supabase, so a hit rate that quietly collapses is the
  // first sign the egress bill is about to come back.
  app.get("/health", (c) =>
    c.json({
      ok: true,
      caches: { nodeAuth: obsNodeAuthCacheStats(), ingestNodeAuth: ingestNodeAuthCacheStats() },
    }),
  );

  // ============================================
  // SECURITY MIDDLEWARE (Applied in order)
  // ============================================

  // Sentry must be first — sets up tracing and Hono's onError capture.
  // Staging and production share one Doppler config, so the DSN is namespaced
  // per app; the bare SENTRY_DSN fallback keeps the per-app dev configs working.
  const sentryDsn = env.SENTRY_DSN_REST_API || env.SENTRY_DSN;

  if (sentryDsn && env.NODE_ENV !== "development") {
    app.use("*", sentry(app, {
      ...getSentryOptions({ dsn: sentryDsn, service: "rest-api" }),
      integrations: [createSupabaseIntegration(Sentry), createConsoleLogsIntegration()],
    }));
    console.log("[sentry] active");
  } else {
    console.log("[sentry] inactive (no SENTRY_DSN)");
  }

  app.use("*", metricsMiddleware("rest-api"));
  app.use("*", securityMiddleware.requestId());

  // 2. HTTPS enforcement (production only)
  app.use("*", securityMiddleware.enforceHttps());

  // 3. Security headers
  app.use("*", securityMiddleware.securityHeaders());

  // 6. Brute force protection (after auth, before routes)
  app.use("*", securityMiddleware.bruteForceProtection());

  // Anything a route or middleware throws: generic JSON 500 with the request id.
  app.onError(createApiErrorHandler());

  // ============================================
  // ROUTES
  // ============================================

  app.get("/", (c) => {
    return c.json({ message: "StreamWizard API", version: "1.0.0" });
  });

  // Twitch EventSub Webhook Handler
  app.route("/webhooks/twitch/eventsub", eventsubRoutes);

  // Proxmox VE / PBS notification webhooks (backup monitoring). Token header
  // auth inside the route; 404 unless configured (prod only).
  app.route("/webhooks/proxmox", proxmoxWebhook);

  // Backup status for web-admin's server side (bearer secret). Before the
  // "/api/*" CORS + Supabase middleware: no browser and no user session here.
  app.route("/internal/backups", internalBackups);

  // Node claim handshake -- called by obs-instance-manager's install script
  // from a fresh, untrusted VM with a one-time token, no Supabase session
  // involved. Registered before the cookie/CORS-oriented "/api/*" middleware
  // below so it doesn't inherit either, same as the webhook route above.
  app.route("/api/obs-nodes", obsNodeRoutes);

  // Same rationale as above, for ingest-server's install script.
  app.route("/api/ingest-nodes", ingestNodeRoutes);

  // ============================================
  // API ROUTES (User-facing)
  // ============================================

  // Enable CORS for API routes
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:3000", "https://streamwizard.org", "https://staging.streamwizard.org"], // Add your frontend URLs
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    }),
  );

  // Apply Supabase middleware to all API routes
  app.use("/api/*", supabaseMiddleware());

  // Clip sync for the signed-in user, behind the CORS and Supabase middleware above.
  app.route("/api/clips", clipSyncRoutes);

  return app;
}
