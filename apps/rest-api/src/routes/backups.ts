import { supabase } from "@repo/supabase";
import { insertBackupEvent, listBackupEvents } from "@repo/supabase/queries/backups";
import { Hono } from "hono";
import { backupConfig } from "../lib/backup-config";
import { cachedBackupEventsSince, cachedBackupPoll, invalidateBackupCache } from "../lib/backup-cache";
import { env } from "../lib/env";
import { internalAuth } from "../middleware/internal-auth";
import { backupPoller } from "../services/backup-poller";
import { createBackupsInternalRoute } from "./backups-internal";
import { createProxmoxWebhookRoute } from "./proxmox-webhook";

// Wiring for backup monitoring. Both routes answer 404 unless the PBS config
// is set (prod only), so staging never stores or serves anything.

/** POST /webhooks/proxmox — shared-secret header auth inside the route. */
export const proxmoxWebhook = createProxmoxWebhookRoute({
  secret: backupConfig ? env.BACKUP_WEBHOOK_SECRET : undefined,
  loadPoll: () => cachedBackupPoll(backupConfig!.pollId),
  insert: (row) => insertBackupEvent(supabase, row),
  onStored: () => {
    invalidateBackupCache();
    backupPoller?.pollSoon();
  },
});

/** /internal/backups — bearer secret, called by web-admin's server only. */
export const internalBackups = new Hono();
internalBackups.use("*", internalAuth(backupConfig ? env.REST_API_INTERNAL_SECRET : undefined));
internalBackups.route(
  "/",
  createBackupsInternalRoute({
    loadPoll: () => cachedBackupPoll(backupConfig!.pollId),
    listEventsSince: (since) => cachedBackupEventsSince(since),
    listEvents: (opts) => listBackupEvents(supabase, opts),
    forcePoll: backupPoller
      ? async () => {
          const result = await backupPoller!.poll({ force: true });
          invalidateBackupCache();
          return result;
        }
      : null,
  }),
);
