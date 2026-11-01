import { classifyEvent, type BackupEventGuest, type BackupEventLite, type BackupPollData } from "@repo/backups";
import { supabase } from "@repo/supabase";
import {
  deleteBackupEvents,
  getBackupPollState,
  listUnmatchedBackupEvents,
  markBackupEventsMatched,
  type BackupEventLiteRow,
} from "@repo/supabase/queries/backups";

/** Unmatched events older than this are dropped even if discovery never ran. */
const UNMATCHED_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function loadBackupPoll(pollId: string): Promise<BackupPollData | null> {
  const row = await getBackupPollState(supabase, pollId);
  const data = row?.data as BackupPollData | null | undefined;
  return data && data.version === 1 ? data : null;
}

export function toEventLite(row: BackupEventLiteRow): BackupEventLite {
  return {
    id: row.id,
    source: row.source,
    eventType: row.event_type,
    jobId: row.job_id,
    severity: row.severity,
    title: row.title,
    occurredAt: row.occurred_at,
    receivedAt: row.received_at,
    guests: (row.guests as BackupEventGuest[] | null) ?? null,
  };
}

/**
 * Events that arrived before job discovery could vouch for them. Once the
 * poll knows the jobs, each one is either confirmed or deleted, so events
 * of other jobs never stay in the table.
 */
export async function reconcileUnmatchedEvents(poll: BackupPollData, now = Date.now()): Promise<{ matched: number; dropped: number }> {
  const rows = await listUnmatchedBackupEvents(supabase);
  if (rows.length === 0) return { matched: 0, dropped: 0 };

  const matched: string[] = [];
  const dropped: string[] = [];
  for (const row of rows) {
    const fields = (row.fields ?? {}) as Record<string, string>;
    const ownership = classifyEvent(poll, { source: row.source, type: row.event_type, jobId: row.job_id, datastore: fields.datastore ?? null });
    if (ownership === "ours") matched.push(row.id);
    else if (ownership === "not-ours" || now - Date.parse(row.received_at) > UNMATCHED_MAX_AGE_MS) dropped.push(row.id);
  }
  await markBackupEventsMatched(supabase, matched);
  await deleteBackupEvents(supabase, dropped);
  return { matched: matched.length, dropped: dropped.length };
}
