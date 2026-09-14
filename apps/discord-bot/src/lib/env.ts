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

  // Required: link buttons are built from it, and an undefined base makes
  // discord.js reject the button URL at runtime.
  NEXT_PUBLIC_BASE_URL: z.string().url(),

  // GitHub App (ticket → issue sync)
  // Optional: without all four the bot still starts and "Move to GitHub"
  // replies that GitHub isn't set up.
  GITHUB_APP_ID: z.string().min(1).optional(),
  GITHUB_APP_PRIVATE_KEY: z.string().min(1).optional(),
  GITHUB_APP_INSTALLATION_ID: z.string().min(1).optional(),
  GITHUB_ISSUES_REPO: z.string().min(1).optional(), // "owner/repo"

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
});

export const env = schema.parse(process.env);
