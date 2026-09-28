import { supabase } from "@repo/supabase";
import { insertBackupEvent, listBackupEvents, listBackupEventsSince } from "@repo/supabase/queries/backups";
import { Hono } from "hono";
import { backupConfig } from "../lib/backup-config";
import { loadBackupPoll } from "../lib/backup-store";
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
  loadPoll: () => loadBackupPoll(backupConfig!.pollId),
  insert: (row) => insertBackupEvent(supabase, row),
  onStored: () => backupPoller?.pollSoon(),
});

/** /internal/backups — bearer secret, called by web-admin's server only. */
export const internalBackups = new Hono();
internalBackups.use("*", internalAuth(backupConfig ? env.REST_API_INTERNAL_SECRET : undefined));
internalBackups.route(
  "/",
  createBackupsInternalRoute({
    loadPoll: () => loadBackupPoll(backupConfig!.pollId),
    listEventsSince: (since) => listBackupEventsSince(supabase, since),
    listEvents: (opts) => listBackupEvents(supabase, opts),
    forcePoll: backupPoller ? () => backupPoller!.poll({ force: true }) : null,
  }),
);
