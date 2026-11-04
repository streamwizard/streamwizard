import { z } from "zod"
import { serviceJwksJsonSchema } from "@repo/service-token/jwks"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  // Read by @repo/sentry (and @repo/posthog/server) as the environment name,
  // before NODE_ENV. Usually unset on the Bun services.
  APP_ENV: z.string().optional(),
  PORT: z.coerce.number().default(8000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Per-service public keys (@repo/service-token): { keys: [{ ...jwk, kid, svc }] },
  // parsed and checked here (public Ed25519 keys of known services only).
  // Gates the /internal/* routes and the role=bot, consumer, ingest-node and
  // monitor upgrades, each by the calling service's SERVICE_POLICY. Not secret.
  WS_SERVICE_JWKS: serviceJwksJsonSchema.optional(),

  // InfluxDB (@repo/metrics). Metrics are off unless all three are set.
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_TOKEN: z.string().min(1).optional(),
  INFLUXDB_ORG: z.string().min(1).optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
