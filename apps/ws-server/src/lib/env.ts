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

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
