import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "staging", "production"]).default("development"),

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

  // Tailscale OAuth client, scoped to auth_keys for tag:ingest-node and
  // tag:obs-node. Used by /api/ingest-nodes/claim and /api/nodes/claim (via
  // lib/tailscale.ts) to mint a fresh, single-use, tagged auth key per node
  // instead of requiring an admin to paste one in by hand.
  TAILSCALE_OAUTH_CLIENT_ID: z.string().min(1),
  TAILSCALE_OAUTH_CLIENT_SECRET: z.string().min(1),

  // Sentry
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_RELEASE: z.string().optional(),

  // PostHog (server-side capture; analytics silently off when unset)
  POSTHOG_KEY: z.string().min(1).optional(),
  POSTHOG_HOST: z.string().url().optional(),
  // Comma-separated account ids: flagged as internal / never sent at all.
  POSTHOG_INTERNAL_USER_IDS: z.string().optional(),
  POSTHOG_OPT_OUT_USER_IDS: z.string().optional(),

  // Shared CDN bucket, for removing a user's ticket attachments when Twitch
  // revokes StreamWizard (user.authorization.revoke). Optional: without all
  // four the account is still deleted and the skipped purge is reported.
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_ASSETS_BUCKET: z.string().min(1).optional(),

  // InfluxDB — one org per environment, buckets are fixed in @repo/metrics.
  // INFLUXDB_TOKEN is the env's shared token (scripts/influx-setup.sh). The
  // optional node tokens override it with one write-only on the obs-nodes /
  // ingest-nodes bucket. Either way the token is relayed to nodes in the
  // /claim response so they can report host + instance metrics without a
  // manual .env edit per node. Optional: a claim still succeeds without
  // these, it just omits them from the response (see ingest-nodes.ts /
  // nodes.ts), same as install.sh already tolerates a missing tailscale_authkey.
  INFLUXDB_URL: z.string().url().optional(),
  INFLUXDB_ORG: z.string().optional(),
  INFLUXDB_TOKEN: z.string().optional(),
  INFLUXDB_OBS_NODE_TOKEN: z.string().optional(),
  INFLUXDB_INGEST_NODE_TOKEN: z.string().optional(),

  // ws-server broadcast — relayed to OBS nodes in the /claim response so the
  // obs-instance-manager can push container lifecycle events to the owning
  // user's browser room. Optional and paired: a claim omits both from the
  // response unless both are set. CONSUMER_SECRET must match the ws-server's.
  WS_SERVER_URL: z.string().optional(),
  CONSUMER_SECRET: z.string().optional(),

  // Go-live posts in the StreamWizard Discord (SW-336): stream.online posts an
  // embed in the guild's live channel through Discord REST, stream.offline
  // edits it. Optional and paired: without both, the Discord step is skipped
  // and everything else in the handlers runs as before.
  DISCORD_BOT_TOKEN: z.string().min(1).optional(),
  DISCORD_GUILD_ID: z.string().min(1).optional(),

  // Proxmox backup monitoring (docs/backup-monitoring-plan.md). Prod only:
  // without PBS_URL + PBS_NAMESPACE + both token vars the poller never starts.
  // The token only holds DatastoreAudit, so it can read backup metadata but
  // never change, restore or delete anything.
  PBS_URL: z.string().url().optional(),
  PBS_DATASTORE: z.string().min(1).default("nas-backups"),
  PBS_NAMESPACE: z.string().min(1).optional(),
  PBS_TOKEN_ID: z.string().min(1).optional(),
  PBS_TOKEN_SECRET: z.string().min(1).optional(),
  // JSON array of {name, url, tokenId, tokenSecret}, one per PVE host
  // (PVEAuditor tokens). Parsed in lib/backup-config.ts.
  PVE_HOSTS: z.string().optional(),
  // Backups run once a day and webhooks report each run (plus a poll a
  // minute later), so the scheduled poll is only the safety net: every 6 h.
  // "Poll now" on /backups forces one.
  BACKUP_POLL_SECONDS: z.coerce.number().int().min(60).default(6 * 60 * 60),
  // Shared secret the Proxmox webhook targets send in X-Proxmox-Webhook-Token
  // (stored as a notification secret on each host). Unset = receiver off.
  BACKUP_WEBHOOK_SECRET: z.string().min(32).optional(),

  // Bearer secret for /internal/* (server-to-server from web-admin). Unset =
  // those routes answer 404.
  REST_API_INTERNAL_SECRET: z.string().min(32).optional(),
});

export const env = schema.parse(process.env);
