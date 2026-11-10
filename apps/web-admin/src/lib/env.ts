import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";
import { isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR } from "@repo/service-token/signing-jwk";
import { snowflakeSchema } from "@repo/schemas/ids";

// Derive NEXT_PUBLIC_ vars from their non-prefixed Doppler counterparts.
// next.config.ts does the same to bake them into the client bundle at build time.
// Assigning undefined to process.env stores the *string* "undefined", which then
// fails validation even for optional vars (stg sets no SENTRY_DSN) — leave unset.
function derive(key: string, value: string | undefined): void {
  if (value !== undefined) process.env[key] = value;
}

derive("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL);
derive("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_PUBLIC_KEY);
derive("NEXT_PUBLIC_SENTRY_DSN", process.env.NEXT_PUBLIC_SENTRY_DSN ?? process.env.SENTRY_DSN_WEB_ADMIN ?? process.env.SENTRY_DSN);

export const env = createEnv({
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
  // Readable on the server and in the browser.
  shared: {
    NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),
    // Doppler's NODE_ENV, baked in by next.config.ts at build time: the
    // standalone server forces NODE_ENV=production, so this is the real
    // environment name. @repo/sentry reads it too.
    APP_ENV: z.enum(["development", "staging", "production"]).optional(),
  },
  server: {
    INFLUXDB_URL: z.string().url(),
    INFLUXDB_TOKEN: z.string().min(1),
    INFLUXDB_ORG: z.string().min(1),
    SUPABASE_URL: z.string().url(),
    SUPABASE_PUBLIC_KEY: z.string().min(1),
    SUPABASE_SECRET_KEY: z.string().min(1),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().optional(),
    // Alert routing/display — the engine itself runs in apps/alert-worker; the
    // /alerts UI still reads these for notification defaults and test sends.
    // Next standalone overwrites NODE_ENV=production at startup, so non-prod
    // deployments must state their env explicitly for alert routing.
    ALERT_ENV: z.enum(["prod", "staging", "dev"]).optional(),
    ALERT_DISCORD_CHANNEL_ID: z.string().min(1).optional(),
    // The alert-worker's tick length; @repo/alerting's rules derive some
    // debounces from it (default 15 when unset).
    TICK_SECONDS: z.coerce.number().int().positive().optional(),
    DISCORD_BOT_TOKEN: z.string().min(1).optional(),
    // Discord dashboard (/discord). The pages show a "not configured" card
    // until the guild id and bot token are set. CLIENT_ID lists deployed
    // slash commands; DISCORD_BOT_INTERNAL_URL reaches the bot's Hono server
    // for cache refreshes and actions, with service tokens signed by
    // WS_SERVICE_SIGNING_JWK — without them saves still land in the DB and
    // the bot's cache TTLs pick them up.
    DISCORD_GUILD_ID: snowflakeSchema.optional(),
    DISCORD_CLIENT_ID: snowflakeSchema.optional(),
    DISCORD_BOT_INTERNAL_URL: z.string().url().optional(),
    // Old bearer secret for the bot. While set it is sent instead of a token;
    // delete it to switch to tokens, then it goes away (SW-494).
    DISCORD_BOT_INTERNAL_SECRET: z.string().min(16).optional(),
    // Banner uploads in the Discord message builder go to the shared CDN
    // bucket under discord-banners/. Without all four plus NEXT_PUBLIC_CDN_URL
    // the upload button is off and banners use theme images only.
    R2_ACCOUNT_ID: z.string().min(1).optional(),
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_ASSETS_BUCKET: z.string().min(1).optional(),
    // web-streamwizard's origin (https://streamwizard.org). The Content
    // section builds preview links on it and tells it which cached pages
    // changed: POST {CMS_SITE_URL}/api/revalidate with the shared secret.
    // Without the pair, saves still land and the site catches up within the
    // hour; without the URL, preview links can't be made.
    CMS_SITE_URL: z.string().url().optional(),
    CMS_REVALIDATE_SECRET: z.string().min(32).optional(),
    TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
    TELEGRAM_CHAT_ID: z.string().min(1).optional(),
    // Same var the rest of the stack uses for the rest-api base URL; the
    // ws-server probe derives from NEXT_PUBLIC_WS_SERVER_URL. Node install
    // commands on /obs and /ingest embed it, so it must be set.
    STREAMWIZARD_API_URL: z.string().url(),
    // Encrypts OBS WS passwords written to obs_instances; must be byte-identical
    // to web-streamwizard's key or its user-facing pages can't decrypt them.
    TOKEN_ENCRYPTION_KEY: z.string().min(1),
    // Auto-switcher config pushes and socket revokes ride ws-server's
    // /internal/* routes, signed with WS_SERVICE_SIGNING_JWK. Optional —
    // without it saves still land in the DB and the engine's 60s reconcile
    // picks them up. The same key signs the live monitor's 60-second socket
    // tokens (actions/ws/monitor-token.ts); the browser dials NEXT_PUBLIC_WS_SERVER_URL,
    // which next.config.ts derives from this.
    WS_SERVER_URL: z.string().min(1).optional(),
    // Ed25519 private JWK this app signs its service tokens with, for
    // ws-server, rest-api /internal/* and the discord-bot API
    // (@repo/service-token reads it). Secret. Optional: without it those calls
    // are skipped as unconfigured; a malformed one stops boot.
    WS_SERVICE_SIGNING_JWK: z.string().min(1).refine(isServiceSigningJwk, SERVICE_SIGNING_JWK_ERROR).optional(),
    // Old bearer secret for rest-api's /internal/backups (the /backups page).
    // While set it is sent instead of a service token; delete it to switch to
    // tokens, then it goes away (SW-494).
    REST_API_INTERNAL_SECRET: z.string().min(32).optional(),
    // JSON array of Proxmox hosts, same value as rest-api's (Doppler). /vms
    // reads guest IPs, agent state and disk use from these on demand; without
    // it those columns show "—". Parsed by @repo/proxmox, never logged.
    PVE_HOSTS: z.string().min(1).optional(),
    // /eventsub reads the conduit, its shards and the subscription inventory
    // from Helix with the app token (@repo/twitch-api reads these straight
    // from process.env). Without all three the Helix panels show as not configured.
    TWITCH_CLIENT_ID: z.string().min(1).optional(),
    TWITCH_CLIENT_SECRET: z.string().min(1).optional(),
    TWITCH_CONDUIT_ID: z.string().min(1).optional(),
    // /users/[id]/eventsub resync creates the channel's webhook subscriptions
    // (stream.online/offline, channel.update) with it. Without it the resync
    // still creates conduit subscriptions and reports the webhook ones.
    TWITCH_WEBHOOK_SECRET: z.string().min(1).optional(),
    // Ed25519 private JWK that signs the 60-second node tokens sent to OBS
    // nodes instead of the user's Supabase session (@repo/node-token). Secret,
    // one per environment, never per node. Optional so the app boots without
    // it; node calls fail with a clear error until it is set.
    NODE_TOKEN_SIGNING_JWK: z.string().min(1).optional(),
  },
  client: {
    NEXT_PUBLIC_WS_SERVER_URL: z.string().min(1).optional(),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_CDN_URL: z.string().url().optional(),
    // Allowed in the CSP (src/lib/csp.ts) for the widget-moderation previews:
    // the overlay app the widgets call, and the media-library asset CDN.
    NEXT_PUBLIC_OVERLAY_URL: z.url().optional(),
    NEXT_PUBLIC_ASSET_CDN_URL: z.url().optional(),
  },
  runtimeEnv: {
    INFLUXDB_URL: process.env.INFLUXDB_URL,
    INFLUXDB_TOKEN: process.env.INFLUXDB_TOKEN,
    INFLUXDB_ORG: process.env.INFLUXDB_ORG,
    NODE_ENV: process.env.NODE_ENV,
    APP_ENV: process.env.APP_ENV,
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLIC_KEY: process.env.SUPABASE_PUBLIC_KEY,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    SENTRY_DSN: process.env.SENTRY_DSN,
    SENTRY_RELEASE: process.env.SENTRY_RELEASE,
    ALERT_ENV: process.env.ALERT_ENV,
    ALERT_DISCORD_CHANNEL_ID: process.env.ALERT_DISCORD_CHANNEL_ID,
    TICK_SECONDS: process.env.TICK_SECONDS,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_CLIENT_ID: process.env.DISCORD_CLIENT_ID,
    DISCORD_BOT_INTERNAL_URL: process.env.DISCORD_BOT_INTERNAL_URL,
    DISCORD_BOT_INTERNAL_SECRET: process.env.DISCORD_BOT_INTERNAL_SECRET,
    R2_ACCOUNT_ID: process.env.R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY,
    R2_ASSETS_BUCKET: process.env.R2_ASSETS_BUCKET,
    CMS_SITE_URL: process.env.CMS_SITE_URL,
    CMS_REVALIDATE_SECRET: process.env.CMS_REVALIDATE_SECRET,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID,
    STREAMWIZARD_API_URL: process.env.STREAMWIZARD_API_URL,
    TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
    WS_SERVER_URL: process.env.WS_SERVER_URL,
    WS_SERVICE_SIGNING_JWK: process.env.WS_SERVICE_SIGNING_JWK,
    REST_API_INTERNAL_SECRET: process.env.REST_API_INTERNAL_SECRET,
    PVE_HOSTS: process.env.PVE_HOSTS,
    TWITCH_CLIENT_ID: process.env.TWITCH_CLIENT_ID,
    TWITCH_CLIENT_SECRET: process.env.TWITCH_CLIENT_SECRET,
    TWITCH_CONDUIT_ID: process.env.TWITCH_CONDUIT_ID,
    TWITCH_WEBHOOK_SECRET: process.env.TWITCH_WEBHOOK_SECRET,
    NODE_TOKEN_SIGNING_JWK: process.env.NODE_TOKEN_SIGNING_JWK,
    NEXT_PUBLIC_WS_SERVER_URL: process.env.NEXT_PUBLIC_WS_SERVER_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_CDN_URL: process.env.NEXT_PUBLIC_CDN_URL,
    NEXT_PUBLIC_OVERLAY_URL: process.env.NEXT_PUBLIC_OVERLAY_URL,
    NEXT_PUBLIC_ASSET_CDN_URL: process.env.NEXT_PUBLIC_ASSET_CDN_URL,
  },
});
