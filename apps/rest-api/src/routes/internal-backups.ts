import {
  computeBackupOverview,
  type BackupEventDetail,
  type BackupEventLite,
  type BackupEventsResponse,
  type BackupOverviewResponse,
  type BackupPollData,
  type BackupVmDetailResponse,
} from "@repo/backups";
import type { BackupEventLiteRow, BackupEventRow } from "@repo/supabase/queries/platform/backups";
import { Hono } from "hono";
import { z } from "zod";
import { toEventLite } from "@/modules/backups/store";
import type { PollResult } from "@/modules/backups/poller";

/**
 * Read-only backup status for web-admin.
 * Everything is served from Supabase; nothing here calls PBS or PVE, except
 * /refresh, which runs one normal (rate-limited) poll.
 */

const vmidParam = z.coerce.number().int().positive().max(999_999_999);

/** GET /events query: a page of events older than `before` (the last page's nextBefore). */
const eventsQuerySchema = z.object({
  before: z.iso.datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** Events read for per-VM "last event" and host webhook silence. */
const EVENT_WINDOW_MS = 8 * 24 * 60 * 60 * 1000;

export interface BackupsInternalDeps {
  loadPoll: () => Promise<BackupPollData | null>;
  listEventsSince: (sinceIso: string) => Promise<BackupEventLiteRow[]>;
  listEvents: (opts: { before?: string; limit?: number; vmid?: number }) => Promise<BackupEventRow[]>;
  /** null when the poller isn't running in this process. */
  forcePoll: (() => Promise<PollResult>) | null;
  now?: () => Date;
}

function toEventDetail(row: BackupEventRow): BackupEventDetail {
  return { ...toEventLite(row), message: row.message, fields: (row.fields ?? {}) as Record<string, string> };
}

export function createBackupsInternalRoute(deps: BackupsInternalDeps) {
  const now = deps.now ?? (() => new Date());
  const route = new Hono();

  async function overview() {
    const at = now();
    const [poll, rows] = await Promise.all([deps.loadPoll(), deps.listEventsSince(new Date(at.getTime() - EVENT_WINDOW_MS).toISOString())]);
    const events: BackupEventLite[] = rows.map(toEventLite);
    return { poll, events, overview: computeBackupOverview(poll, events, at) };
  }

  route.get("/", async (c) => {
    const { events, overview: o } = await overview();
    const body: BackupOverviewResponse = { ...o, recentEvents: events.slice(0, 10) };
    return c.json(body);
  });

  route.get("/vms/:vmid", async (c) => {
    const parsed = vmidParam.safeParse(c.req.param("vmid"));
    if (!parsed.success) return c.json({ error: "Invalid vmid" }, 400);
    const vmid = parsed.data;

    const { poll, overview: o } = await overview();
    const vm = o.vms.find((v) => v.vmid === vmid);
    if (!vm) return c.json({ error: "Unknown VM" }, 404);

    const rows = await deps.listEvents({ vmid, limit: 30 });
    const body: BackupVmDetailResponse = {
      vm,
      snapshots: (poll?.pbs.data?.snapshots ?? []).filter((s) => Number(s.id) === vmid).sort((a, b) => b.time - a.time),
      events: rows.map(toEventDetail),
      pbsStale: o.pbs.stale,
    };
    return c.json(body);
  });

  route.get("/events", async (c) => {
    const query = eventsQuerySchema.safeParse(c.req.query());
    if (!query.success) return c.json({ error: "Invalid query" }, 400);
    const { before, limit } = query.data;
    const rows = await deps.listEvents({ before, limit });
    const body: BackupEventsResponse = {
      events: rows.map(toEventDetail),
      nextBefore: rows.length === limit ? rows[rows.length - 1]!.occurred_at : null,
    };
    return c.json(body);
  });

  route.post("/refresh", async (c) => {
    if (!deps.forcePoll) return c.json({ error: "Poller is not running" }, 503);
    const result = await deps.forcePoll();
    if (!result.polled) return c.json({ error: "Polled less than a minute ago", retryAfterSeconds: 60 }, 429);
    const { events, overview: o } = await overview();
    const body: BackupOverviewResponse = { ...o, recentEvents: events.slice(0, 10) };
    return c.json(body);
  });

  return route;
}
