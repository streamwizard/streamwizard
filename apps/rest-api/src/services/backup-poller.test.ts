import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { BackupPollData, PbsData, PveHostData } from "@repo/backups";

// Same process-wide mock shape as the other rest-api tests.
let reported: string[] = [];
mock.module("@repo/sentry", () => ({
  reportError: (_error: unknown, context: string) => {
    reported.push(context);
  },
}));

// Keeps the env schema (and its required prod vars) out of the test.
mock.module("../lib/backup-config", () => ({ backupConfig: null }));

const { createBackupPoller, nextHealth } = await import("./backup-poller");
const { fetchPbs, fetchPve } = await import("../lib/backup-sources");
const { createProxmoxClient, pbsAuthorization, pveAuthorization, ProxmoxApiError } = await import("../lib/proxmox-client");

const NOW = new Date("2026-09-28T12:00:00Z");
const pbsData: PbsData = { datastore: null, snapshots: [], gc: null, verifyJobs: [], pruneJobs: [] };
const pveData: PveHostData = { node: "pve1", jobs: [], guests: [], failedRuns: [] };

describe("backup poller", () => {
  let saved: BackupPollData[];
  beforeEach(() => {
    saved = [];
    reported = [];
  });

  const make = (over: Partial<Parameters<typeof createBackupPoller>[0]> = {}) =>
    createBackupPoller({
      datastore: "nas-backups",
      namespace: "streamwizard",
      intervalSeconds: 300,
      claim: async () => true,
      load: async () => saved.at(-1) ?? null,
      save: async (d) => {
        saved.push(d);
      },
      fetchPbs: async () => ({ data: pbsData, warnings: [] }),
      fetchPve: { pve1: async () => ({ data: pveData, warnings: [] }) },
      now: () => NOW,
      ...over,
    });

  it("skips the pass when another replica holds the claim", async () => {
    const poller = make({ claim: async () => false });
    expect(await poller.poll()).toEqual({ polled: false });
    expect(saved).toHaveLength(0);
  });

  it("asks for a shorter claim window on forced polls", async () => {
    const windows: number[] = [];
    const poller = make({ claim: async (w) => (windows.push(w), true) });
    await poller.poll();
    await poller.poll({ force: true });
    expect(windows).toEqual([290, 60]);
  });

  it("stores each source's data and health", async () => {
    const result = await make().poll();
    expect(result.polled).toBe(true);
    expect(saved[0]!.pbs.health).toEqual({ okAt: NOW.toISOString(), attemptAt: NOW.toISOString(), error: null, failingSince: null });
    expect(saved[0]!.pve.pve1!.data).toEqual(pveData);
  });

  it("keeps the last good data of a failing host and leaves the others alone", async () => {
    await make().poll();
    const later = new Date(NOW.getTime() + 300_000);
    await make({
      now: () => later,
      fetchPve: {
        pve1: async () => {
          throw new Error("pve1 GET /nodes: timed out after 10s");
        },
      },
    }).poll();

    const second = saved[1]!;
    expect(second.pve.pve1!.data).toEqual(pveData);
    expect(second.pve.pve1!.health).toEqual({
      okAt: NOW.toISOString(),
      attemptAt: later.toISOString(),
      error: "pve1 GET /nodes: timed out after 10s",
      failingSince: later.toISOString(),
    });
    expect(second.pbs.health.okAt).toBe(later.toISOString());
  });

  it("dedupes overlapping passes", async () => {
    let calls = 0;
    const poller = make({ claim: async () => (calls++, true) });
    await Promise.all([poller.poll(), poller.poll()]);
    expect(calls).toBe(1);
  });
});

describe("nextHealth", () => {
  it("keeps failingSince across a failure streak", () => {
    const first = nextHealth(undefined, "t1", { ok: false, error: "x" });
    const second = nextHealth(first, "t2", { ok: false, error: "y" });
    expect(second).toEqual({ okAt: null, attemptAt: "t2", error: "y", failingSince: "t1" });
    expect(nextHealth(second, "t3", { ok: true, warnings: ["gc: HTTP 403"] })).toEqual({ okAt: "t3", attemptAt: "t3", error: "gc: HTTP 403", failingSince: null });
  });
});

// --- Fake Proxmox API, to pin the requests and the namespace scoping ---

type Routes = Record<string, unknown | ((url: URL) => unknown)>;

function fakeFetch(routes: Routes, seen: { url: URL; auth: string | null }[]): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    const path = decodeURIComponent(url.pathname).replace("/api2/json", "");
    const route = routes[path];
    if (route === undefined) return new Response(JSON.stringify({ data: null, message: "permission check failed" }), { status: 403 });
    const data = typeof route === "function" ? (route as (u: URL) => unknown)(url) : route;
    return new Response(JSON.stringify({ data }), { status: 200 });
  }) as typeof fetch;
}

describe("proxmox client", () => {
  it("formats the two token headers differently", () => {
    expect(pbsAuthorization("sw-monitor@pbs!rest-api", "s3cret")).toBe("PBSAPIToken=sw-monitor@pbs!rest-api:s3cret");
    expect(pveAuthorization("sw-monitor@pve!rest-api", "s3cret")).toBe("PVEAPIToken=sw-monitor@pve!rest-api=s3cret");
  });

  it("surfaces the Proxmox error message without the token", async () => {
    const client = createProxmoxClient({ baseUrl: "https://pbs:8007", authorization: "PBSAPIToken=a:SECRET", label: "pbs", fetchImpl: fakeFetch({}, []) });
    const error = (await client.get("/nope").catch((e: unknown) => e)) as Error;
    expect(error).toBeInstanceOf(ProxmoxApiError);
    expect(error.message).toBe("pbs GET /nope: HTTP 403 permission check failed");
    expect(error.message).not.toContain("SECRET");
  });
});

describe("fetchPbs", () => {
  it("always scopes snapshots to our namespace and keeps old values for failing extras", async () => {
    const seen: { url: URL; auth: string | null }[] = [];
    const client = createProxmoxClient({
      baseUrl: "https://pbs:8007",
      authorization: "PBSAPIToken=a:b",
      label: "pbs",
      fetchImpl: fakeFetch(
        {
          "/admin/datastore/nas-backups/snapshots": [{ "backup-type": "vm", "backup-id": "103", "backup-time": 1, size: 5 }],
          "/admin/datastore/nas-backups/status": { total: 100, used: 40, avail: 60 },
          "/admin/verify": [{ id: "monthly-reverify", store: "nas-backups", ns: "streamwizard", "last-run-state": "OK" }, { id: "home", store: "nas-backups", ns: "homelab" }],
          "/admin/prune": [{ id: "daily", store: "nas-backups" }],
          // gc missing → 403
        },
        seen,
      ),
    });
    const prevGc = { id: "nas-backups", kind: "gc" as const, state: "ok" as const, stateText: "OK", lastRunAt: 5, nextRunAt: null, schedule: null };
    const { data, warnings } = await fetchPbs(client, "nas-backups", "streamwizard", { ...pbsData, gc: prevGc });

    expect(seen.find((s) => s.url.pathname.endsWith("/snapshots"))!.url.searchParams.get("ns")).toBe("streamwizard");
    expect(data.snapshots).toHaveLength(1);
    expect(data.datastore).toEqual({ totalBytes: 100, usedBytes: 40, availBytes: 60 });
    expect(data.verifyJobs.map((j) => j.id)).toEqual(["monthly-reverify"]);
    expect(data.pruneJobs.map((j) => j.id)).toEqual(["daily"]);
    expect(data.gc).toEqual(prevGc);
    expect(warnings).toEqual(["pbs GET /admin/datastore/nas-backups/gc: HTTP 403 permission check failed"]);
  });
});

describe("fetchPve", () => {
  it("discovers our jobs and reads failed task logs once", async () => {
    const seen: { url: URL; auth: string | null }[] = [];
    const upid = "UPID:pve1:0001:vzdump::root@pam:";
    const client = createProxmoxClient({
      baseUrl: "https://pve1:8006",
      authorization: "PVEAPIToken=a=b",
      label: "pve1",
      fetchImpl: fakeFetch(
        {
          "/nodes": [{ node: "pve1" }],
          "/storage": [
            { storage: "pbs-sw", type: "pbs", datastore: "nas-backups", namespace: "streamwizard" },
            { storage: "pbs-home", type: "pbs", datastore: "nas-backups", namespace: "homelab" },
          ],
          "/cluster/backup": [
            { id: "backup-sw", storage: "pbs-sw", vmid: "100,102", schedule: "03:00" },
            { id: "backup-home", storage: "pbs-home", vmid: "300" },
          ],
          "/nodes/pve1/qemu": [{ vmid: 100, name: "pfsense" }, { vmid: 102, name: "mc-node-1" }, { vmid: 300, name: "home" }],
          "/nodes/pve1/lxc": [],
          "/nodes/pve1/tasks": [
            { upid, type: "vzdump", starttime: 1000, endtime: 1100, status: "job errors" },
            { upid: "UPID:ok", type: "vzdump", starttime: 900, endtime: 950, status: "OK" },
          ],
          [`/nodes/pve1/tasks/${upid}/log`]: [
            { n: 1, t: "INFO: Starting Backup of VM 100 (qemu)" },
            { n: 2, t: "ERROR: Backup of VM 100 failed - connection refused" },
          ],
        },
        seen,
      ),
    });

    const first = await fetchPve(client, "nas-backups", "streamwizard", null, 2000);
    expect(first.data.jobs.map((j) => j.id)).toEqual(["backup-sw"]);
    expect(first.data.failedRuns).toEqual([{ upid, startedAt: 1000, endedAt: 1100, status: "job errors", failedVmids: [100], coveredVmids: [100] }]);

    const logReads = () => seen.filter((s) => s.url.pathname.endsWith("/log")).length;
    expect(logReads()).toBe(1);
    await fetchPve(client, "nas-backups", "streamwizard", first.data, 2000);
    expect(logReads()).toBe(1);
  });
});
