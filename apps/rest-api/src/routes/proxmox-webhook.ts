import { createHash } from "node:crypto";
import { classifyEvent, jobLevelGuests, parseVzdumpGuests, type BackupPollData } from "@repo/backups";
import { reportError } from "@repo/sentry";
import type { Json } from "@repo/supabase";
import type { BackupEventInsert } from "@repo/supabase/queries/backups";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { secretsMatch } from "../lib/secret-compare";

/**
 * Receiver for Proxmox VE / PBS notification webhooks (docs/backup-monitoring-plan.md).
 *
 * Proxmox sends each notification once, with a 10 s timeout and no retry, so
 * this does the minimum before answering: check the token, validate, decide
 * whether the event is ours, store it. Events for other jobs or namespaces
 * are dropped without being stored.
 */

export const WEBHOOK_TOKEN_HEADER = "x-proxmox-webhook-token";

/** vzdump notifications include the full task log; this caps what we keep. */
const MAX_STORED_MESSAGE_CHARS = 64 * 1024;

const payloadSchema = z.object({
  source: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/),
  title: z.string().max(1000),
  message: z.string(),
  severity: z.enum(["info", "notice", "warning", "error", "unknown"]),
  timestamp: z.number().int().positive(),
  // Proxmox metadata fields are strings; accept scalars and stringify.
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
});

export interface ProxmoxWebhookDeps {
  /** Unset disables the receiver (404). */
  secret: string | undefined;
  loadPoll: () => Promise<BackupPollData | null>;
  /** Returns false for a duplicate (same dedupe_key). */
  insert: (row: BackupEventInsert) => Promise<boolean>;
  /** Called after a new event was stored, e.g. to poll PBS soon. */
  onStored?: () => void;
}

export function dedupeKey(parts: { source: string; type: string; jobId: string | null; timestamp: number; title: string }): string {
  return createHash("sha256")
    .update([parts.source, parts.type, parts.jobId ?? "", String(parts.timestamp), parts.title].join("|"))
    .digest("hex");
}

export function createProxmoxWebhookRoute(deps: ProxmoxWebhookDeps) {
  const route = new Hono();

  route.post(
    "/",
    bodyLimit({ maxSize: 1024 * 1024, onError: (c) => c.json({ error: "Payload too large" }, 413) }),
    async (c) => {
      if (!deps.secret) return c.json({ error: "Not found" }, 404);
      if (!secretsMatch(c.req.header(WEBHOOK_TOKEN_HEADER), deps.secret)) return c.json({ error: "Unauthorized" }, 401);

      let body: unknown;
      try {
        body = await c.req.json();
      } catch {
        return c.json({ error: "Body must be JSON" }, 400);
      }
      const parsed = payloadSchema.safeParse(body);
      if (!parsed.success) {
        return c.json({ error: "Invalid payload", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, 400);
      }

      const payload = parsed.data;
      const fields = Object.fromEntries(Object.entries(payload.fields).map(([k, v]) => [k, String(v)]));
      const type = fields.type ?? "unknown";
      const jobId = fields["job-id"] ?? null;

      let poll: BackupPollData | null = null;
      try {
        poll = await deps.loadPoll();
      } catch (error) {
        // Without discovery data the event is kept unmatched, not lost.
        reportError(error, "proxmox-webhook: load poll state");
      }

      const ownership = classifyEvent(poll, { source: payload.source, type, jobId, datastore: fields.datastore ?? null });
      if (ownership === "not-ours") {
        console.log(`[proxmox-webhook] ignored ${payload.source} ${type}${jobId ? ` ${jobId}` : ""} (not a monitored job)`);
        return c.json({ ignored: true }, 202);
      }

      const guests = type === "vzdump" ? (parseVzdumpGuests(payload.message) ?? jobLevelGuests(poll, payload.source, jobId, payload.severity)) : null;

      try {
        const stored = await deps.insert({
          source: payload.source,
          event_type: type,
          job_id: jobId,
          severity: payload.severity,
          title: payload.title,
          message: payload.message.slice(0, MAX_STORED_MESSAGE_CHARS),
          fields: fields as Json,
          guests: guests as unknown as Json,
          matched: ownership === "ours",
          occurred_at: new Date(payload.timestamp * 1000).toISOString(),
          dedupe_key: dedupeKey({ source: payload.source, type, jobId, timestamp: payload.timestamp, title: payload.title }),
        });
        if (stored) {
          console.log(`[proxmox-webhook] stored ${payload.source} ${type} ${payload.severity}${ownership === "unknown" ? " (unmatched)" : ""}`);
          deps.onStored?.();
        }
      } catch (error) {
        reportError(error, "proxmox-webhook: insert");
        return c.json({ error: "Could not store event" }, 500);
      }

      return c.body(null, 204);
    },
  );

  return route;
}
