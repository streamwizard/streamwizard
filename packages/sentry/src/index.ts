import { SupabaseClient } from "@supabase/supabase-js";
import { supabaseIntegration } from "@supabase/sentry-js-integration";

export interface SentryConfig {
  dsn: string;
  service: string;
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
  };
}

export function createSupabaseIntegration(sentry: any) {
  return supabaseIntegration(SupabaseClient, sentry, {
    tracing: true,
    breadcrumbs: true,
    errors: true,
  });
}
