import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
  PORT: z.coerce.number().default(8000),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Per-service public keys (@repo/service-token): { keys: [{ ...jwk, kid, svc }] }.
  // Gates the /internal/* routes and the role=bot, consumer, ingest-node and
  // monitor upgrades, each by the calling service's SERVICE_POLICY. Not secret.
  WS_SERVICE_JWKS: z.string().min(1).optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
})

export const env = schema.parse(process.env)
