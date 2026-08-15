import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseIntegration } from "@supabase/sentry-js-integration";
import { captureException, flush, type ErrorEvent, type Event } from "@sentry/core";

export interface SentryConfig {
  dsn: string;
  service: string;
}

// Patterns that must never appear in Sentry payloads.
const PII_PATTERNS: RegExp[] = [
  /oauth2?[_-]?token[\s=:]+\S+/gi,     // OAuth tokens in messages/frames
  /access_token[\s=:]+\S+/gi,
  /refresh_token[\s=:]+\S+/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, // Authorization header values
  /eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]*/g, // raw JWTs
];

function redactString(value: string): string {
  return PII_PATTERNS.reduce((s, re) => s.replace(re, "[REDACTED]"), value);
}

function scrubEvent<T extends Event>(event: T): T {
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = redactString(ex.value);
      if (ex.stacktrace?.frames) {
        for (const frame of ex.stacktrace.frames) {
          if (frame.vars) {
            for (const key of Object.keys(frame.vars)) {
              const v = frame.vars[key];
              if (typeof v === "string") frame.vars[key] = redactString(v);
            }
          }
        }
      }
    }
  }
  if (event.message) event.message = redactString(event.message);
  return event;
}

export function getSentryOptions(config: SentryConfig) {
  const isProd = process.env.NODE_ENV === "production";
  return {
    dsn: config.dsn,
    // Next's standalone server.js hard-sets NODE_ENV=production at startup,
    // so staging deployments would report as "production" without an explicit
    // override — same reason the alerting package has ALERT_ENV (see
    // packages/alerting/src/home-env.ts). `||` not `??`: build-time env
    // inlining can turn unset vars into empty strings.
    environment: process.env.SENTRY_ENVIRONMENT || process.env.ALERT_ENV || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    enableLogs: true,
    sendDefaultPii: false,
    initialScope: {
      tags: { service: config.service },
    },
    beforeSend: (event: ErrorEvent) => scrubEvent(event),
  };
}

// Many SDKs (Supabase above all) return errors as values instead of throwing,
// so framework error hooks never see them — checking the error and bailing
// silently drops the only record of what went wrong. Funnel those paths
// through here before bailing. Captures via @sentry/core against whichever
// client the app initialized; the console.error keeps a trail in server logs
// where Sentry is disabled (dev) or the event never arrives.
export function reportError(error: unknown, context: string): void {
  console.error(`[${context}]`, error);
  captureException(error, { tags: { context } });
}

// Sentry batches events and sends them in the background, so a process that
// exits promptly — SIGTERM on deploy, `process.exit` after a failed startup —
// takes the queue with it. The events lost that way are exactly the ones worth
// having. Await this before any deliberate exit. Never throws and never blocks
// past the timeout: a shutdown that hangs on telemetry is worse than a missing
// event.
export async function flushSentry(timeoutMs = 2000): Promise<void> {
  try {
    await flush(timeoutMs);
  } catch {
    // No client bound (Sentry disabled in dev) or the transport failed — the
    // caller is on its way out either way.
  }
}

export function createSupabaseIntegration(sentry: any) {
  return supabaseIntegration(SupabaseClient, sentry, {
    tracing: true,
    breadcrumbs: true,
    errors: true,
  });
}
