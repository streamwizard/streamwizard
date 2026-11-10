import { createEnv } from "@t3-oss/env-nextjs"
import { z } from "zod"
import { isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR } from "@repo/service-token/signing-jwk"

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts so they
// exist in process.env before createEnv validates them. The next.config.ts env:
// block does the same derivation to bake them into the client bundle at build time.
//
// Assigned through this helper because `process.env.X = undefined` stores the
// *string* "undefined" -- a truthy value that then fails anything parsing it as
// a URL (see the images.remotePatterns block in next.config.ts).
function deriveEnv(key: string, ...sources: (string | undefined)[]) {
  const value = sources.find((v) => v !== undefined && v !== "");
  if (value !== undefined) process.env[key] = value;
}

deriveEnv("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL);
deriveEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, process.env.SUPABASE_PUBLIC_KEY);
deriveEnv("NEXT_PUBLIC_WS_SERVER_URL", process.env.NEXT_PUBLIC_WS_SERVER_URL, process.env.WS_SERVER_URL);
deriveEnv("NEXT_PUBLIC_SENTRY_DSN", process.env.NEXT_PUBLIC_SENTRY_DSN, process.env.SENTRY_DSN_WEB_STREAMWIZARD, process.env.SENTRY_DSN);
// User assets live in the same R2 bucket as our static CDN (under assets/),
// so the asset CDN URL falls back to NEXT_PUBLIC_CDN_URL unless overridden.
deriveEnv(
  "NEXT_PUBLIC_ASSET_CDN_URL",
  process.env.NEXT_PUBLIC_ASSET_CDN_URL,
  process.env.ASSET_CDN_URL,
  process.env.NEXT_PUBLIC_CDN_URL,
);

export const env = createEnv({
  // Readable on the server and in the browser.
  shared: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    // Doppler's NODE_ENV, baked in by next.config.ts at build time: the
    // standalone server forces NODE_ENV=production, so this is the real
    // environment name. @repo/sentry and @repo/posthog/server read it too.
    APP_ENV: z.enum(["development", "staging", "production"]).optional(),
  },
  server: {
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    TWITCH_CLIENT_ID: z.string().min(1),
    TWITCH_CLIENT_SECRET: z.string().min(1),
    TWITCH_WEBHOOK_SECRET: z.string().min(1),
    TWITCH_CONDUIT_ID: z.string().min(1),
    DISCORD_CLIENT_ID: z.string().min(1),
    DISCORD_CLIENT_SECRET: z.string().min(1),
    DISCORD_BOT_TOKEN: z.string().min(1),
    DISCORD_GUILD_ID: z.string().min(1),
    WS_SERVER_URL: z.string(),
    STREAMWIZARD_API_URL: z.string().url(),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().optional(),
    // Comma-separated account ids that objected to server-side analytics.
    // Nothing is sent to PostHog for them.
    POSTHOG_OPT_OUT_USER_IDS: z.string().optional(),
    // Server-side PostHog (@repo/posthog/server, the crawler log in the proxy).
    // The NEXT_PUBLIC_ pair is used when these are unset.
    POSTHOG_KEY: z.string().min(1).optional(),
    POSTHOG_HOST: z.url().optional(),
    // Cloudflare R2 for user-uploaded overlay assets (media library). Optional
    // so environments without the feature configured still boot; the asset
    // actions throw a clear error when missing.
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_ASSETS_BUCKET: z.string().min(1).optional(),
    // Shared with web-admin and rest-api: they send it to POST /api/revalidate
    // after a blog post or guide changes. Unset = the endpoint 404s.
    CMS_REVALIDATE_SECRET: z.string().min(32).optional(),
    // Ed25519 private JWK that signs the 60-second node tokens sent to OBS
    // nodes instead of the user's Supabase session (@repo/node-token). Secret,
    // one per environment, never per node. Optional so the app boots without
    // it; node calls fail with a clear error until it is set.
    NODE_TOKEN_SIGNING_JWK: z.string().min(1).optional(),
    // Ed25519 private JWK that signs this app's ws-server tokens (broadcasts,
    // socket revokes; @repo/service-token reads it). Secret. Optional: without
    // it those calls are skipped as unconfigured; a malformed one stops boot.
    WS_SERVICE_SIGNING_JWK: z.string().min(1).refine(isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR).optional(),
    // web-admin's origin, allowed to frame the CMS draft previews (src/proxy.ts).
    CMS_ADMIN_URL: z.url().optional(),
    // Comma-separated extra hosts allowed to reach the dev server and its HMR
    // websocket (next.config.ts allowedDevOrigins), e.g. a LAN address for
    // testing from another device. Dev only; 127.0.0.1 is always allowed.
    DEV_ALLOWED_ORIGINS: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_WS_SERVER_URL: z.string(),
    NEXT_PUBLIC_BASE_URL: z.string().url(),
    NEXT_PUBLIC_OVERLAY_URL: z.string().url(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z.string().url().default("https://eu.i.posthog.com"),
    NEXT_PUBLIC_CDN_URL: z.string().url(),
    // Public custom domain of the R2 user-assets bucket (media library).
    // Separate from NEXT_PUBLIC_CDN_URL, which serves our own static assets.
    NEXT_PUBLIC_ASSET_CDN_URL: z.string().url().optional(),
    NEXT_PUBLIC_DOCS_URL: z.string().url().optional(),
    // Shown in the IRL setup when the user has no ingest node with a public
    // host or Tailscale IP yet (placeholders otherwise).
    NEXT_PUBLIC_INGEST_HOST: z.string().min(1).optional(),
    NEXT_PUBLIC_OBS_PULL_HOST: z.string().min(1).optional(),
    // SRT latency of the OBS pull from the ingest node (lib/obs/obs-irl.ts).
    NEXT_PUBLIC_OBS_PULL_LATENCY_MS: z.coerce.number().int().positive().optional(),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    TWITCH_WEBHOOK_SECRET: process.env.TWITCH_WEBHOOK_SECRET,
    TWITCH_CONDUIT_ID: process.env.TWITCH_CONDUIT_ID,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET: process.env.DISCORD_CLIENT_SECRET,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    POSTHOG_OPT_OUT_USER_IDS: process.env.POSTHOG_OPT_OUT_USER_IDS,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ASSETS_BUCKET: process.env.R2_ASSETS_BUCKET,
    CMS_REVALIDATE_SECRET: process.env.CMS_REVALIDATE_SECRET,
    NODE_TOKEN_SIGNING_JWK: process.env.NODE_TOKEN_SIGNING_JWK,
    WS_SERVICE_SIGNING_JWK: process.env.WS_SERVICE_SIGNING_JWK,
    POSTHOG_KEY: process.env.POSTHOG_KEY,
    POSTHOG_HOST: process.env.POSTHOG_HOST,
    CMS_ADMIN_URL: process.env.CMS_ADMIN_URL,
    DEV_ALLOWED_ORIGINS: process.env.DEV_ALLOWED_ORIGINS,
    // Derived in next.config.ts env: block from their non-prefixed Doppler counterparts
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
    NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_ASSET_CDN_URL: process.env.NEXT_PUBLIC_ASSET_CDN_URL,
    NEXT_PUBLIC_DOCS_URL: process.env.NEXT_PUBLIC_DOCS_URL,
    NEXT_PUBLIC_INGEST_HOST: process.env.NEXT_PUBLIC_INGEST_HOST,
    NEXT_PUBLIC_OBS_PULL_HOST: process.env.NEXT_PUBLIC_OBS_PULL_HOST,
    NEXT_PUBLIC_OBS_PULL_LATENCY_MS: process.env.NEXT_PUBLIC_OBS_PULL_LATENCY_MS,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
})
