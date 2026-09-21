import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseIntegration } from "@supabase/sentry-js-integration";
import {
  captureException,
  consoleLoggingIntegration,
  flush,
  type ErrorEvent,
  type Event,
  type Log,
} from "@sentry/core";

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

// Log lines that are expected and carry nothing to act on. Keep this short and
// say why each one is here; anything else belongs in the code that logs it.
const IGNORED_LOG_PATTERNS: RegExp[] = [
  // An overlay left open in OBS across a deploy calls server actions that no
  // longer exist. Next logs it; the overlay recovers on its next reload.
  /Failed to find Server Action/,
  /The Server Reference ID did not match the expected format/,
];

// Logs skip beforeSend entirely, so without this every token or JWT that
// reaches a console call is stored as-is. Redacts the message and every
// string attribute (the console integration puts each argument in one), and
// drops the known-noise lines above.
export function scrubLog(log: Log): Log | null {
  const message = String(log.message);
  if (IGNORED_LOG_PATTERNS.some((re) => re.test(message))) return null;
  log.message = redactString(message);
  if (log.attributes) {
    for (const [key, value] of Object.entries(log.attributes)) {
      if (typeof value === "string") log.attributes[key] = redactString(value);
    }
  }
  return log;
}

const APP_ENVS = ["production", "staging", "development"];

// NODE_ENV from Doppler is the one source for the environment name. Next.js
// apps can't read it at runtime (the standalone server.js hard-sets
// NODE_ENV=production and the browser bundle has it baked in), so their
// next.config copies it into APP_ENV at build time, while `next build` still
// has Doppler's value. Everything else reads NODE_ENV directly.
//
// Throws on anything else: reporting under a wrong or made-up environment
// splits the issue stream silently, so a misconfigured deploy should fail to
// boot instead.
export function sentryEnvironment(): string {
  const env = process.env.APP_ENV || process.env.NODE_ENV;
  if (!env || !APP_ENVS.includes(env)) {
    throw new Error(`NODE_ENV must be one of ${APP_ENVS.join(", ")} (got ${env ? `"${env}"` : "nothing"})`);
  }
  return env;
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

// The free plan has no per-project rate limits, so one error thrown in a loop
// used the whole org's monthly quota in days and blinded every other project
// for three weeks (ALERT-WORKER-1, Aug–Sep 2026). This is the safety net for
// the next loop nobody has written a limit for yet: per process, the same
// error goes through at most `perKey` times a day, and all errors together at
// most `total` times a day. The window is a day, not an hour, because the
// whole org gets ~167 errors a day on the free plan: 20 a day from one stuck
// loop in prod and staging is ~1.2k a month, 10 an hour would be ~14k. Code
// that already throttles its own reports (the alert engine, the EventSub
// receiver) stays under both.
export interface ErrorLimiterOptions {
  perKey: number;
  total: number;
  windowMs: number;
  now?: () => number;
}

// Two events count as "the same error" when they share type and message once
// ids and numbers are blanked out, so "clip 123 failed" and "clip 456 failed"
// share a budget.
export function errorLimitKey(event: Event): string {
  const ex = event.exception?.values?.at(-1);
  const raw = ex ? `${ex.type ?? "Error"}: ${ex.value ?? ""}` : (event.message ?? "unknown");
  return raw
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "<id>")
    .replace(/\d+/g, "<n>")
    .slice(0, 200);
}

export function createErrorLimiter(options: ErrorLimiterOptions): (event: Event) => boolean {
  const now = options.now ?? Date.now;
  let windowStart = now();
  let total = 0;
  const perKey = new Map<string, number>();
  const warned = new Set<string>();

  return (event: Event): boolean => {
    const t = now();
    if (t - windowStart >= options.windowMs) {
      windowStart = t;
      total = 0;
      perKey.clear();
      warned.clear();
    }
    const key = errorLimitKey(event);
    const keyCount = (perKey.get(key) ?? 0) + 1;
    perKey.set(key, keyCount);
    total++;
    if (keyCount <= options.perKey && total <= options.total) return true;

    // One line per key per window, so the log itself can't become the flood.
    const reason = keyCount > options.perKey ? key : "all errors";
    if (!warned.has(reason)) {
      warned.add(reason);
      console.warn(`[sentry] dropping "${reason}" until the daily error budget resets`);
    }
    return false;
  };
}

const errorLimiter = createErrorLimiter({ perKey: 20, total: 200, windowMs: 24 * 60 * 60_000 });

export function getSentryOptions(config: SentryConfig) {
  const environment = sentryEnvironment();
  const isProd = environment === "production";
  return {
    dsn: config.dsn,
    environment,
    // `||` not `??`, and undefined rather than "": Next inlines unset vars as
    // empty strings, and an empty release is a real release value to Sentry —
    // every event would be tagged with a release that matches no uploaded
    // source map. Undefined lets the SDK fall back to what the bundler injected.
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: isProd ? 0.1 : 1.0,
    enableLogs: true,
    sendDefaultPii: false,
    initialScope: {
      tags: { service: config.service },
    },
    beforeSend: (event: ErrorEvent) => (errorLimiter(event) ? scrubEvent(event) : null),
    beforeSendLog: (log: Log) => scrubLog(log),
  };
}

// Many SDKs (Supabase above all) return errors as values instead of throwing,
// so framework error hooks never see them — checking the error and bailing
// silently drops the only record of what went wrong. Funnel those paths
// through here before bailing. Captures via @sentry/core against whichever
// client the app initialized; the console.error keeps a trail in server logs
// where Sentry is disabled (dev) or the event never arrives.
//
// `extra` carries the per-call detail that used to live in the console.error
// message (which broadcaster, which iteration). It stays out of the `context`
// tag on purpose: tags are indexed for grouping, so folding an id into one
// gives every occurrence its own bucket and the issue never aggregates.
export function reportError(error: unknown, context: string, extra?: Record<string, unknown>): void {
  if (extra) console.error(`[${context}]`, extra, error);
  else console.error(`[${context}]`, error);
  captureException(error, { tags: { context }, extra });
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

// An uncaughtException means a stack unwound past every handler: locks may be
// held, sockets half-written, module state half-mutated. Registering a handler
// stops the runtime from exiting on its own, so a process that "survives" one
// keeps serving from that state — the failure mode that produces the confusing
// second incident. Report, flush, exit non-zero, let the container restart.
//
// Deliberately not used for unhandledRejection: a stray rejected promise is
// usually a local mistake rather than a corrupted process, and exiting on one
// turns a logged warning into an outage.
export function reportFatal(error: unknown, context: string): void {
  console.error(`[${context}] fatal — exiting`, error);
  captureException(error);
  // Never let a hung transport hold the process open; flushSentry is already
  // bounded and never throws.
  void flushSentry().finally(() => {
    globalThis.process?.exit?.(1);
  });
}

// Forwards existing console output into Sentry Logs, so container logs survive
// a redeploy and are searchable across services instead of living in
// `docker logs` on one box. Pairs with enableLogs in getSentryOptions, which
// only opens the transport — without this nothing feeds it.
//
// Only `warn` and `error` are forwarded. `log`/`info` are routine lifecycle
// chatter (ticks, reconnects, chat traffic) that made up >95% of the volume,
// and logs are a metered category; they still print to the container output.
// Call Sentry.logger.info directly for the rare info line worth keeping. See
// docs/sentry-log-noise-plan.md for the policy.
export function createConsoleLogsIntegration() {
  return consoleLoggingIntegration({ levels: ["warn", "error"] });
}

export function createSupabaseIntegration(sentry: any) {
  return supabaseIntegration(SupabaseClient, sentry, {
    tracing: true,
    breadcrumbs: true,
    errors: true,
  });
}
