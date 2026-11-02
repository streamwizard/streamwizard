import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Monitor (optional — live WS inspector)
  MONITOR_SECRET: z.string().min(1).optional(),

  // Per-service public keys (@repo/service-token): { keys: [{ ...jwk, kid, svc }] }.
  // Gates POST /internal/broadcast, POST /internal/revoke and the role=consumer
  // and role=bot upgrades, each by the calling service's SERVICE_POLICY. Not secret.
  WS_SERVICE_JWKS: z.string().min(1).optional(),
  // Legacy shared secrets, accepted next to service tokens until this is true:
  // CONSUMER_SECRET for broadcast/revoke/consumer, SUPABASE_SECRET_KEY for bots.
  // Turn on once every caller in this environment signs service tokens
  // (ingest nodes still log in as bots with SUPABASE_SECRET_KEY).
  WS_SERVICE_AUTH_REQUIRED: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
  CONSUMER_SECRET: z.string().min(1).optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
