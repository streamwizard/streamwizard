import { z } from "zod"
import { isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR } from "@repo/service-token/signing-jwk"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  // Read by @repo/sentry (and @repo/posthog/server) as the environment name,
  // before NODE_ENV. Usually unset on the Bun services.
  APP_ENV: z.string().optional(),
  // /health (docker healthcheck).
  PORT: z.coerce.number().int().positive().default(8030),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),
  TWITCH_CONDUIT_ID: z.string().min(1),
  /** Shards the conduit should have. The bot grows the conduit to this, never shrinks it. */
  EVENTSUB_SHARD_COUNT: z.coerce.number().int().min(1).max(20_000).default(1),
  /** Which shards this process runs ("0-9", "0,2,4"); unset runs all of them. For splitting across processes. */
  EVENTSUB_SHARD_IDS: z.string().optional(),

  // Internal
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

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
  // Comma-separated account ids that objected; nothing is sent for them.
  POSTHOG_OPT_OUT_USER_IDS: z.string().optional(),
})

export const env = schema.parse(process.env)
