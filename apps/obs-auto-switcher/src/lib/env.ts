import { z } from "zod"
import { isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR } from "@repo/service-token/signing-jwk"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  // Read by @repo/sentry (and @repo/posthog/server) as the environment name,
  // before NODE_ENV. Usually unset on the Bun services.
  APP_ENV: z.string().optional(),
  // HTTP server (/health).
  PORT: z.coerce.number().int().positive().default(8010),

  // Supabase (service role — config reads, obs_instances/obs_nodes lookups,
  // stream_events inserts)
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // ws-server: consumer feed in (ingest stats + config pushes), bot feed out
  // (status messages to user rooms). Authenticated with service tokens signed
  // by WS_SERVICE_SIGNING_JWK.
  WS_SERVER_URL: z.string().url(),
  // Ed25519 private JWK this service signs its ws-server tokens with
  // (@repo/service-token reads it). Secret. Optional: without it every
  // ws-server call is skipped as unconfigured; a malformed one stops boot.
  WS_SERVICE_SIGNING_JWK: z
    .string()
    .min(1)
    .refine(isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR)
    .optional(),

  // InfluxDB (@repo/metrics). Metrics are off unless all three are set.
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_TOKEN: z.string().min(1).optional(),
  INFLUXDB_ORG: z.string().min(1).optional(),

  // Decrypts each node's per-node obs_command key (from obs_node_api_keys)
  // before calling the node's /obs route. Must match the key the rest-api /
  // nodes encrypt with.
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch app credentials for chat notices (@repo/twitch-api app token path)
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),

  // How often the in-memory config is reloaded wholesale from Supabase. This
  // poll is only the safety net for a dropped consumer-feed push — a config
  // change that lands normally applies in ~1s — so it is tuned for egress, not
  // latency. See the comment on RECONCILE_INTERVAL_MS in modules/config/config-store.ts.
  CONFIG_RECONCILE_INTERVAL_MS: z.coerce.number().int().positive().default(300_000),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
