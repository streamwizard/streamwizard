import { reportError } from "@repo/sentry";
import { supabase } from "@repo/supabase";
import { upsertLatestLabels } from "@repo/supabase/queries/stream-labels";
import { isLabelEventType, latestLabelColumns } from "@repo/schemas";

/**
 * Keeps the stream_labels row (latest follower, sub, cheer, raid, ...) current
 * for one EventSub event.
 *
 * Runs for every label event, live or offline. That is the point: the
 * stream_events log only keeps rows while live, so an offline follow would
 * otherwise never reach "latest follower".
 *
 * Nothing is broadcast from here. Overlays already get the raw event and
 * apply it themselves; this row is what they load on the next refresh.
 * Writing the same "latest" twice (an EventSub redelivery) is harmless.
 *
 * Best-effort: a failure is reported and dropped, it never holds up the
 * event pipeline.
 */
export async function recordStreamLabels(broadcasterId: string, eventType: string, event: unknown): Promise<void> {
  if (!isLabelEventType(eventType)) return;
  const columns = latestLabelColumns(eventType, event, broadcasterId);
  if (!columns) return;

  try {
    const { error } = await upsertLatestLabels(supabase, broadcasterId, columns);
    if (error) throw new Error(error.message);
  } catch (error) {
    reportError(error, "stream-labels.upsert", { broadcasterId, eventType });
  }
}
