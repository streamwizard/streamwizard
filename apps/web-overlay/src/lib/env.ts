import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts so they
// exist in process.env before createEnv validates them. The next.config.ts env:
// block does the same derivation to bake them into the client bundle at build time.
process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLIC_KEY;
process.env.NEXT_PUBLIC_WS_SERVER_URL = process.env.NEXT_PUBLIC_WS_SERVER_URL ?? process.env.WS_SERVER_URL;

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    WS_SERVER_URL: z.string(),
    STREAMWIZARD_API_URL: z.string().url(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WS_SERVER_URL: z.string(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_OVERLAY_URL: z.string().url(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    // Derived in next.config.ts env: block from their non-prefixed Doppler counterparts
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
  },
})
