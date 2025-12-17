import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

    TWITCH_APP_TOKEN: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    TWITCH_WEBHOOK_SECRET: z.string().min(10),

    NODE_ENV: z.enum(["development", "test", "production"]),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().min(1),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),

    NEXT_PUBLIC_BASE_URL: z.string().min(1),

    NEXT_PUBLIC_TWITCH_CLIENT_ID: z.string().min(1),

    NEXT_PUBLIC_SENTRY_DSN: z.string().url(),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TWITCH_CLIENT_ID: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  },
});
