import { z } from "zod"

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

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

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
  // Comma-separated account ids: flagged as internal / never sent at all.
  POSTHOG_INTERNAL_USER_IDS: z.string().optional(),
  POSTHOG_OPT_OUT_USER_IDS: z.string().optional(),
})

export const env = schema.parse(process.env)
