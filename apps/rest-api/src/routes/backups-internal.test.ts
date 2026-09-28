import { describe, expect, it } from "bun:test";
import type { BackupPollData } from "@repo/backups";
import type { BackupEventRow } from "@repo/supabase/queries/backups";
import { Hono } from "hono";
import { internalAuth } from "../middleware/internal-auth";
import { createBackupsInternalRoute } from "./backups-internal";

const NOW = new Date("2026-09-28T12:00:00Z");
const nowSec = NOW.getTime() / 1000;
const recent = new Date(NOW.getTime() - 60_000).toISOString();
const health = { okAt: recent, attemptAt: recent, error: null, failingSince: null };
const SECRET = "i".repeat(40);

const poll: BackupPollData = {
  version: 1,
  datastore: "nas-backups",
  namespace: "streamwizard",
  pbs: {
    health,
    data: {
      datastore: { totalBytes: 100, usedBytes: 10, availBytes: 90 },
      snapshots: [
        { type: "vm", id: "103", time: nowSec - 3600, sizeBytes: 5, comment: "obs-node-1", verification: "ok", protected: false },
        { type: "vm", id: "100", time: nowSec - 3600, sizeBytes: 5, comment: "pfsense", verification: "ok", protected: false },
      ],
      gc: null,
      verifyJobs: [],
      pruneJobs: [],
    },
  },
  pve: {},
};

const row = (id: string, occurredAt: string): BackupEventRow => ({
  id,
  source: "pve",
  event_type: "vzdump",
  job_id: "backup-sw",
  severity: "info",
  title: "ok",
  message: "VMID Name Status\n103 obs-node-1 ok",
  fields: { type: "vzdump" },
  guests: [{ vmid: 103, name: "obs-node-1", status: "ok" }],
  matched: true,
  occurred_at: occurredAt,
  received_at: occurredAt,
  dedupe_key: id,
});

function app(forced: boolean | null = true) {
  const a = new Hono();
  a.use("*", internalAuth(SECRET));
  a.route(
    "/",
    createBackupsInternalRoute({
      loadPoll: async () => poll,
      listEventsSince: async () => [row("e1", recent)],
      listEvents: async (opts) => (opts.limit === 1 ? [row("e1", recent)] : [row("e1", recent)]),
      forcePoll: forced === null ? null : async () => (forced ? { polled: true, data: poll } : { polled: false }),
      now: () => NOW,
    }),
  );
  return a;
}

const auth = { authorization: `Bearer ${SECRET}` };

describe("internal backup routes", () => {
  it("require the bearer secret", async () => {
    expect((await app().request("/")).status).toBe(401);
    expect((await app().request("/", { headers: { authorization: "Bearer nope" } })).status).toBe(401);
    const off = new Hono();
    off.use("*", internalAuth(undefined));
    off.get("/", (c) => c.text("x"));
    expect((await off.request("/", { headers: auth })).status).toBe(404);
  });

  it("serves the overview with recent events", async () => {
    const res = await app().request("/", { headers: auth });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.vms.map((v: { vmid: number }) => v.vmid)).toEqual([100, 103]);
    expect(body.recentEvents).toHaveLength(1);
    expect(body.namespace).toBe("streamwizard");
  });

  it("serves one VM with only its own snapshots", async () => {
    const res = await app().request("/vms/103", { headers: auth });
    const body = await res.json();
    expect(body.vm.name).toBe("obs-node-1");
    expect(body.snapshots.map((s: { id: string }) => s.id)).toEqual(["103"]);
    expect(body.events[0].message).toContain("obs-node-1");
    expect((await app().request("/vms/999", { headers: auth })).status).toBe(404);
    expect((await app().request("/vms/abc", { headers: auth })).status).toBe(400);
  });

  it("pages events", async () => {
    const res = await app().request("/events?limit=1", { headers: auth });
    const body = await res.json();
    expect(body.nextBefore).toBe(recent);
    expect((await app().request("/events?before=garbage", { headers: auth })).status).toBe(400);
  });

  it("rate-limits refresh and reports a missing poller", async () => {
    expect((await app(true).request("/refresh", { method: "POST", headers: auth })).status).toBe(200);
    expect((await app(false).request("/refresh", { method: "POST", headers: auth })).status).toBe(429);
    expect((await app(null).request("/refresh", { method: "POST", headers: auth })).status).toBe(503);
  });
});
