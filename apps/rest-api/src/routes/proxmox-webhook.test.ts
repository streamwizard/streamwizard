import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { BackupPollData } from "@repo/backups";
import type { BackupEventInsert } from "@repo/supabase/queries/backups";

mock.module("@repo/sentry", () => ({ reportError: () => {} }));

const { createProxmoxWebhookRoute, WEBHOOK_TOKEN_HEADER } = await import("./proxmox-webhook");

const SECRET = "s".repeat(40);
const health = { okAt: null, attemptAt: null, error: null, failingSince: null };
const poll: BackupPollData = {
  version: 1,
  datastore: "nas-backups",
  namespace: "streamwizard",
  pbs: { health, data: { datastore: null, snapshots: [], gc: null, verifyJobs: [], pruneJobs: [] } },
  pve: {
    pve1: {
      health,
      data: {
        node: "pve1",
        jobs: [{ id: "backup-sw", enabled: true, schedule: "03:00", storage: "pbs-sw", selection: "list", pool: null, vmids: [100, 102] }],
        guests: [],
        failedRuns: [],
      },
    },
  },
};

const vzdump = {
  source: "pve1",
  title: "vzdump backup status (pve1): backup failed",
  message: "VMID  Name     Status  Time  Size  Filename\n100   pfsense  ok      1m    1 GiB vm/100/x\n102   mc-node  err     3s    0 B   null\n",
  severity: "error",
  timestamp: 1790000000,
  fields: { type: "vzdump", hostname: "pve1", "job-id": "backup-sw" },
};

describe("proxmox webhook receiver", () => {
  let rows: BackupEventInsert[];
  let stored: number;
  let current: BackupPollData | null;

  beforeEach(() => {
    rows = [];
    stored = 0;
    current = poll;
  });

  const app = (secret: string | undefined = SECRET) =>
    createProxmoxWebhookRoute({
      secret,
      loadPoll: async () => current,
      insert: async (row) => {
        if (rows.some((r) => r.dedupe_key === row.dedupe_key)) return false;
        rows.push(row);
        return true;
      },
      onStored: () => {
        stored++;
      },
    });

  const send = (body: unknown, token: string | null = SECRET, secret?: string) =>
    app(secret).request("/", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { [WEBHOOK_TOKEN_HEADER]: token } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    });

  it("rejects a missing or wrong token", async () => {
    expect((await send(vzdump, null)).status).toBe(401);
    expect((await send(vzdump, "wrong")).status).toBe(401);
    expect(rows).toHaveLength(0);
  });

  it("is off without a secret", async () => {
    expect((await createProxmoxWebhookRoute({ secret: undefined, loadPoll: async () => null, insert: async () => true }).request("/", { method: "POST" })).status).toBe(404);
  });

  it("validates the payload", async () => {
    expect((await send("not json")).status).toBe(400);
    expect((await send({ ...vzdump, severity: "loud" })).status).toBe(400);
    expect((await send({ ...vzdump, source: "../etc" })).status).toBe(400);
  });

  it("stores our job with parsed guests and pokes the poller", async () => {
    const res = await send(vzdump);
    expect(res.status).toBe(204);
    expect(rows[0]).toMatchObject({
      source: "pve1",
      event_type: "vzdump",
      job_id: "backup-sw",
      severity: "error",
      matched: true,
      occurred_at: new Date(1790000000 * 1000).toISOString(),
      guests: [
        { vmid: 100, name: "pfsense", status: "ok" },
        { vmid: 102, name: "mc-node", status: "failed" },
      ],
    });
    expect(stored).toBe(1);
  });

  it("treats a redelivery as a no-op", async () => {
    await send(vzdump);
    expect((await send(vzdump)).status).toBe(204);
    expect(rows).toHaveLength(1);
    expect(stored).toBe(1);
  });

  it("drops other jobs without storing them", async () => {
    const res = await send({ ...vzdump, fields: { ...vzdump.fields, "job-id": "backup-homelab" } });
    expect(res.status).toBe(202);
    expect(rows).toHaveLength(0);
  });

  it("drops test notifications (no type / job id)", async () => {
    const res = await send({ ...vzdump, title: "Test notification", fields: { hostname: "pve1" } });
    expect(res.status).toBe(202);
    expect(rows).toHaveLength(0);
  });

  it("keeps events unmatched until discovery has run", async () => {
    current = null;
    const res = await send({ ...vzdump, message: "no table here" });
    expect(res.status).toBe(204);
    expect(rows[0]).toMatchObject({ matched: false, guests: null });
  });

  it("falls back to the job's guests when the text doesn't parse", async () => {
    await send({ ...vzdump, message: "job aborted" });
    expect(rows[0]!.guests).toEqual([
      { vmid: 100, name: null, status: "failed" },
      { vmid: 102, name: null, status: "failed" },
    ]);
  });
});
