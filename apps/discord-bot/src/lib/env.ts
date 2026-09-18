import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(1),

  // Discord
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_CLIENT_ID: z.string().min(1),
  // Scopes slash command registration to a single guild for instant propagation in dev.
  // Omit in staging/production to register commands globally.
  DISCORD_GUILD_ID: z.string().min(1).optional(),

  // Internal HTTP server for web-admin (cache refresh, panel re-post, test
  // welcome). The server only starts when the secret is set; never expose the
  // port publicly — web-admin reaches it over the internal network.
  DISCORD_BOT_INTERNAL_SECRET: z.string().min(16).optional(),
  DISCORD_BOT_INTERNAL_PORT: z.coerce.number().int().positive().default(3010),

  // Ticket transcripts copy small images here (shared CDN bucket). Without all
  // of them transcripts still save, with attachment metadata only.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_ASSETS_BUCKET: z.string().min(1).optional(),
  NEXT_PUBLIC_CDN_URL: z.string().url().optional(),

  // Required: link buttons are built from it, and an undefined base makes
  // discord.js reject the button URL at runtime.
  NEXT_PUBLIC_BASE_URL: z.string().url(),

  // web-admin, for ticket links in the log channel. Optional: without it the
  // ticket embeds mention the channel instead.
  WEB_ADMIN_URL: z.string().url().optional(),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
});

export const env = schema.parse(process.env);
