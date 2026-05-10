import { z } from "zod";
import { createEnv } from "@t3-oss/env-nextjs";

export const env = createEnv({
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().length(64, "Encryption key must be 64 hex characters (32 bytes)"),
  },
  experimental__runtimeEnv: {},
});
