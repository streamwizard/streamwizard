import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "staging", "production"])
    .default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_PUBLIC_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),
  TOKEN_ENCRYPTION_KEY: z.string().min(1),

  // Twitch
  TWITCH_CLIENT_ID: z.string().min(1),
  TWITCH_CLIENT_SECRET: z.string().min(1),
  TWITCH_WEBHOOK_SECRET: z.string().min(1),

  // Public URL returned to nodes during /claim so they know where to send requests
  STREAMWIZARD_API_URL: z.string().url(),

  // S3 BUCKET OBS
  OBS_S3_ACCESS_KEY: z.string().min(1),
  OBS_S3_BUCKET: z.string().min(1),
  OBS_S3_ENDPOINT: z.url(),
  OBS_S3_REGION: z.string().min(1),
  OBS_S3_SECRET_KEY: z.string().min(1),




  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),
});

export const env = schema.parse(process.env);
