import type { BackupPollData } from "@repo/backups";
import { supabase } from "@repo/supabase";
import { listBackupEventsSince, type BackupEventLiteRow } from "@repo/supabase/queries/backups";
import { TtlCache } from "@repo/ttl-cache";
import { loadBackupPoll } from "./backup-store";

/**
 * Short-lived read cache for the backup state. web-admin's /backups page
 * refreshes every few seconds while open, and the data only changes when the
 * poller saves (every 5 min) or a webhook arrives, so without this every
 * refresh re-reads the poll row and the event list from Supabase (egress).
 * Both writers in this process call invalidateBackupCache().
 */

const TTL_MS = 30_000;

const pollCache = new TtlCache<BackupPollData>({ ttlMs: TTL_MS });
const eventsCache = new TtlCache<BackupEventLiteRow[]>({ ttlMs: TTL_MS });

export function cachedBackupPoll(pollId: string): Promise<BackupPollData | null> {
  return pollCache.fetch(pollId, () => loadBackupPoll(pollId));
}

/** `sinceIso` only matters on a miss; the window is fixed, so one key is enough. */
export async function cachedBackupEventsSince(sinceIso: string): Promise<BackupEventLiteRow[]> {
  return (await eventsCache.fetch("recent", () => listBackupEventsSince(supabase, sinceIso))) ?? [];
}

export function invalidateBackupCache(): void {
  pollCache.clear();
  eventsCache.clear();
}
