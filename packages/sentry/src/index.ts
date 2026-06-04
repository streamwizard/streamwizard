import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseIntegration } from "@supabase/sentry-js-integration";
import type { ErrorEvent, Event } from "@sentry/core";

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
    environment: process.env.NODE_ENV ?? "development",
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

export function createSupabaseIntegration(sentry: any) {
  return supabaseIntegration(SupabaseClient, sentry, {
    tracing: true,
    breadcrumbs: true,
    errors: true,
  });
}
