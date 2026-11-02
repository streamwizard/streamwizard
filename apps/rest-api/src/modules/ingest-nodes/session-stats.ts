import type { Context } from "hono";
import { supabase } from "@repo/supabase";
import { getIngestSessionOwnersForNode, insertIngestSessionStatsBatch } from "@repo/supabase/queries/ingest";
import { ingestSessionStatsSchema } from "@/schemas/ingest-nodes";

// How many session ids go into one owner lookup (they travel in the URL).
const OWNER_LOOKUP_CHUNK = 200;

/**
 * POST /api/ingest-nodes/session-stats
 *   { rows: [...] }  (every ~30s per node)
 * → 202 { ok: true, inserted }
 *
 * user_id comes from each row's session, never from the node. Rows for a
 * session that is unknown or belongs to another node are dropped. Rows for a
 * session that already ended are kept: the last batch usually lands after
 * the session's /end.
 */
export async function postSessionStats(c: Context) {
  const nodeId = c.get("ingestNodeId");
  const parsed = ingestSessionStatsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: "Invalid body" }, 400);

  const ids = [...new Set(parsed.data.rows.map((r) => r.session_id))];
  const owners = new Map<string, string>();
  for (let i = 0; i < ids.length; i += OWNER_LOOKUP_CHUNK) {
    const chunk = await getIngestSessionOwnersForNode(supabase, ids.slice(i, i + OWNER_LOOKUP_CHUNK), nodeId);
    for (const [id, userId] of chunk) owners.set(id, userId);
  }

  const rows = parsed.data.rows.flatMap((r) => {
    const userId = owners.get(r.session_id);
    return userId ? [{ ...r, user_id: userId }] : [];
  });
  if (rows.length > 0) {
    const { error } = await insertIngestSessionStatsBatch(supabase, rows);
    if (error) return c.json({ error: "Could not store the stats" }, 500);
  }
  return c.json({ ok: true, inserted: rows.length }, 202);
}
