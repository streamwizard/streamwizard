import { supabase } from "@repo/supabase";
import { getIngestSessionOwnersForNode, insertIngestSessionStatsBatch } from "@repo/supabase/queries/ingest/ingest";
import type { IngestSessionStatsRow } from "@/modules/ingest-nodes/schemas";

// How many session ids go into one owner lookup (they travel in the URL).
const OWNER_LOOKUP_CHUNK = 200;

/**
 * POST /api/ingest-nodes/session-stats (every ~30s per node). Returns how
 * many rows were stored, or null when the insert failed.
 *
 * user_id comes from each row's session, never from the node. Rows for a
 * session that is unknown or belongs to another node are dropped. Rows for a
 * session that already ended are kept: the last batch usually lands after
 * the session's /end.
 */
export async function storeSessionStats(nodeId: string, statsRows: IngestSessionStatsRow[]): Promise<number | null> {
  const ids = [...new Set(statsRows.map((r) => r.session_id))];
  const owners = new Map<string, string>();
  for (let i = 0; i < ids.length; i += OWNER_LOOKUP_CHUNK) {
    const chunk = await getIngestSessionOwnersForNode(supabase, ids.slice(i, i + OWNER_LOOKUP_CHUNK), nodeId);
    for (const [id, userId] of chunk) owners.set(id, userId);
  }

  const rows = statsRows.flatMap((r) => {
    const userId = owners.get(r.session_id);
    return userId ? [{ ...r, user_id: userId }] : [];
  });
  if (rows.length > 0) {
    const { error } = await insertIngestSessionStatsBatch(supabase, rows);
    if (error) return null;
  }
  return rows.length;
}
