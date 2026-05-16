import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Match `packages/env/src/index.ts`: server-style `.env.local` (`SUPABASE_URL`,
 * `SUPABASE_SECRET_KEY`, `SUPABASE_ANON_KEY`) can coexist with Next’s
 * `NEXT_PUBLIC_*` and `SUPABASE_SERVICE_ROLE_KEY` naming.
 *
 * Runs before `@t3-oss/env-nextjs` so both naming styles validate.
 */
function applyAliasesForNextProcessEnv(): void {
  const e = process.env;

  if (!e.SUPABASE_URL && e.NEXT_PUBLIC_SUPABASE_URL) {
    e.SUPABASE_URL = e.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (!e.NEXT_PUBLIC_SUPABASE_URL && e.SUPABASE_URL) {
    e.NEXT_PUBLIC_SUPABASE_URL = e.SUPABASE_URL;
  }

  if (!e.SUPABASE_ANON_KEY && e.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    e.SUPABASE_ANON_KEY = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }
  if (!e.NEXT_PUBLIC_SUPABASE_ANON_KEY && e.SUPABASE_ANON_KEY) {
    e.NEXT_PUBLIC_SUPABASE_ANON_KEY = e.SUPABASE_ANON_KEY;
  }

  if (!e.TWITCH_CLIENT_ID && e.NEXT_PUBLIC_TWITCH_CLIENT_ID) {
    e.TWITCH_CLIENT_ID = e.NEXT_PUBLIC_TWITCH_CLIENT_ID;
  }
  if (!e.NEXT_PUBLIC_TWITCH_CLIENT_ID && e.TWITCH_CLIENT_ID) {
    e.NEXT_PUBLIC_TWITCH_CLIENT_ID = e.TWITCH_CLIENT_ID;
  }

  if (!e.SUPABASE_SERVICE_ROLE_KEY && e.SUPABASE_SECRET_KEY) {
    e.SUPABASE_SERVICE_ROLE_KEY = e.SUPABASE_SECRET_KEY;
  }
  if (!e.SUPABASE_SECRET_KEY && e.SUPABASE_SERVICE_ROLE_KEY) {
    e.SUPABASE_SECRET_KEY = e.SUPABASE_SERVICE_ROLE_KEY;
  }
}

applyAliasesForNextProcessEnv();

/** Public URL helpers: allow empty `.env`; override in deployment. */
function urlOrDefault(schema: z.ZodString, fallbackUrl: string) {
  return z.preprocess((value) => {
    if (typeof value === "string" && value.trim() !== "") return value.trim();
    return fallbackUrl;
  }, schema);
}

export const env = createEnv({
  server: {
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_WEBHOOK_SECRET: z.string().min(10),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    STREAMWIZARD_API_URL: z.string().url().optional(),
    TWITCH_CONDUIT_ID: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_BASE_URL: urlOrDefault(z.string().url(), "http://localhost:3000"),
    NEXT_PUBLIC_TWITCH_CLIENT_ID: z.string().min(1),
    NEXT_PUBLIC_OVERLAY_URL: urlOrDefault(z.string().url(), "http://localhost:3001"),
    NEXT_PUBLIC_IRL_WS_URL: urlOrDefault(z.string().url(), "ws://localhost:3009"),
  },
  experimental__runtimeEnv: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_TWITCH_CLIENT_ID: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
    NEXT_PUBLIC_IRL_WS_URL: process.env.NEXT_PUBLIC_IRL_WS_URL,
  },
});
