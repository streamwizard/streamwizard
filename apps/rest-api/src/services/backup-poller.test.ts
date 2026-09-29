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
const { downloadSnapshotFile, fetchPbs, fetchPbsUsage, fetchPve } = await import("../lib/backup-sources");
const { createProxmoxClient, pbsAuthorization, pveAuthorization, ProxmoxApiError } = await import("@repo/proxmox");

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
    // File downloads answer with the raw body, not a {data} envelope.
    if (data instanceof Uint8Array) return new Response(new Blob([data as Uint8Array<ArrayBuffer>]), { status: 200 });
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
          "/admin/datastore/nas-backups/snapshots": [{ "backup-type": "vm", "backup-id": "103", "backup-time": 1, size: 5, files: [{ filename: "index.json.blob" }] }],
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
    // The usage pass failing (no manifest here) is only a warning too.
    expect(warnings).toEqual([
      "usage: vm/103/1: pbs GET /admin/datastore/nas-backups/download-decoded: HTTP 403 permission check failed",
      "pbs GET /admin/datastore/nas-backups/gc: HTTP 403 permission check failed",
    ]);
    expect(data.snapshots[0]!.usage).toBeNull();
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
          "/nodes/pve1/qemu/100/config": { name: "pfsense", scsi1: "local-lvm:vm-100-disk-0,size=8G", ide2: "none,media=cdrom" },
          "/nodes/pve1/qemu/102/config": { scsi0: "local-lvm:vm-102-disk-0,size=32G", scsi1: "local-lvm:vm-102-disk-1,backup=0,size=1T" },
          "/nodes/pve1/qemu/300/config": { scsi0: "local-lvm:vm-300-disk-0,size=1G" },
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
    expect(first.warnings).toEqual([]);
    // Disk sizes for our guests only; the homelab guest's config is never read.
    expect(first.data.guests.find((g) => g.vmid === 100)!.disks).toEqual([{ key: "scsi1", sizeBytes: 8 * 1024 ** 3, backedUp: true }]);
    expect(first.data.guests.find((g) => g.vmid === 102)!.disks!.map((d) => d.backedUp)).toEqual([true, false]);
    expect(first.data.guests.find((g) => g.vmid === 300)!.disks).toBeUndefined();
    expect(seen.some((s) => s.url.pathname.includes("/qemu/300/config"))).toBe(false);
    expect(first.data.failedRuns).toEqual([{ upid, startedAt: 1000, endedAt: 1100, status: "job errors", failedVmids: [100], coveredVmids: [100] }]);

    const logReads = () => seen.filter((s) => s.url.pathname.endsWith("/log")).length;
    expect(logReads()).toBe(1);
    await fetchPve(client, "nas-backups", "streamwizard", first.data, 2000);
    expect(logReads()).toBe(1);
  });
});

// --- Usage pass: chunk indexes + manifests ---

const MiB4 = 4 * 1024 * 1024;

/** A .fidx with 4 MiB chunks; digests named by one byte each. */
function fidx(digestBytes: number[]): Uint8Array {
  const buf = new Uint8Array(4096 + digestBytes.length * 32);
  buf.set([47, 127, 65, 237, 145, 253, 15, 205], 0);
  const view = new DataView(buf.buffer);
  view.setBigUint64(64, BigInt(digestBytes.length * MiB4), true);
  view.setBigUint64(72, BigInt(MiB4), true);
  digestBytes.forEach((b, i) => buf.set(new Uint8Array(32).fill(b), 4096 + i * 32));
  return buf;
}

const manifest = (size: number, compressed: number) =>
  new TextEncoder().encode(JSON.stringify({ unprotected: { chunk_upload_stats: { count: 1, duplicates: 0, size, compressed_size: compressed } } }));

const snapFiles = ["qemu-server.conf.blob", "drive-scsi0.img.fidx", "index.json.blob", "client.log.blob"];
const snapshot = (time: number) => ({ type: "vm", id: "100", time, sizeBytes: 1, comment: null, verification: "ok" as const, protected: false });

function usageFetch(seen: { url: URL; auth: string | null }[], indexes: Record<number, number[]>) {
  return fakeFetch(
    {
      "/admin/datastore/nas-backups/download": (url: URL) => fidx(indexes[Number(url.searchParams.get("backup-time"))]!),
      "/admin/datastore/nas-backups/download-decoded": (url: URL) =>
        url.searchParams.get("file-name") === "index.json.blob" ? manifest(4 * MiB4, 2 * MiB4) : new Uint8Array(0),
    },
    seen,
  );
}

describe("downloadSnapshotFile", () => {
  const client = createProxmoxClient({ baseUrl: "https://pbs:8007", authorization: "PBSAPIToken=a:b", label: "pbs", fetchImpl: usageFetch([], { 1: [1] }) });

  it("fetches index files raw and only the manifest decoded", async () => {
    const seen: { url: URL; auth: string | null }[] = [];
    const c = createProxmoxClient({ baseUrl: "https://pbs:8007", authorization: "PBSAPIToken=a:b", label: "pbs", fetchImpl: usageFetch(seen, { 1: [1] }) });
    await downloadSnapshotFile(c, "nas-backups", "streamwizard", snapshot(1), "drive-scsi0.img.fidx");
    await downloadSnapshotFile(c, "nas-backups", "streamwizard", snapshot(1), "index.json.blob");
    expect(seen.map((s) => [s.url.pathname.split("/").pop(), s.url.searchParams.get("file-name"), s.url.searchParams.get("ns")])).toEqual([
      ["download", "drive-scsi0.img.fidx", "streamwizard"],
      ["download-decoded", "index.json.blob", "streamwizard"],
    ]);
  });

  it("refuses every other file", async () => {
    for (const name of ["qemu-server.conf.blob", "client.log.blob", "root.pxar", "../x.fidx"]) {
      await expect(downloadSnapshotFile(client, "nas-backups", "streamwizard", snapshot(1), name)).rejects.toThrow("refusing");
    }
  });
});

describe("fetchPbsUsage", () => {
  const files = (times: number[]) => new Map(times.map((t) => [`vm/100/${t}`, snapFiles]));

  it("works out sizes, then reuses the result while nothing changed", async () => {
    const seen: { url: URL; auth: string | null }[] = [];
    const client = createProxmoxClient({ baseUrl: "https://pbs:8007", authorization: "PBSAPIToken=a:b", label: "pbs", fetchImpl: usageFetch(seen, { 1: [1, 2, 3, 3], 2: [1, 2, 4, 4], 3: [5, 2, 4, 4] }) });

    const snaps = [snapshot(2), snapshot(1)];
    const first = await fetchPbsUsage(client, "nas-backups", "streamwizard", snaps, files([1, 2]), null, 100);
    const upload = { uploadedRawBytes: 4 * MiB4, uploadedBytes: 2 * MiB4 };
    // 1 and 2 share chunks 1 and 2; 3 is only in snapshot 1, 4 only in 2.
    expect(first.snapshots.get("vm/100/1")).toEqual({ exclusiveBytes: MiB4, ...upload });
    expect(first.snapshots.get("vm/100/2")).toEqual({ exclusiveBytes: MiB4, ...upload });
    expect(first.usage.groups["vm/100"]).toEqual({
      logicalBytes: 8 * MiB4,
      uniqueBytes: 4 * MiB4,
      uniqueChunks: 4,
      sharedBytes: 0,
      compression: 0.5,
      onDiskEstBytes: 2 * MiB4,
    });
    expect(seen).toHaveLength(4);

    const prev: PbsData = { ...pbsData, snapshots: snaps.map((s) => ({ ...s, usage: first.snapshots.get(`vm/100/${s.time}`)! })), usage: first.usage };
    const again = await fetchPbsUsage(client, "nas-backups", "streamwizard", snaps, files([1, 2]), prev, 200);
    expect(again.usage).toBe(first.usage);
    expect(seen).toHaveLength(4);

    // A new backup and a prune of the oldest: indexes again, the manifest only
    // for the new one; snapshot 2 loses nothing to 3 except chunk 4.
    const next = [snapshot(3), snapshot(2)];
    const third = await fetchPbsUsage(client, "nas-backups", "streamwizard", next, files([2, 3]), prev, 300);
    expect(third.snapshots.get("vm/100/2")!.exclusiveBytes).toBe(MiB4);
    expect(third.snapshots.get("vm/100/3")!.exclusiveBytes).toBe(MiB4);
    expect(third.usage.groups["vm/100"]!.uniqueChunks).toBe(4);
    expect(seen.slice(4).map((s) => `${s.url.pathname.split("/").pop()} ${s.url.searchParams.get("backup-time")}`).sort()).toEqual(["download 2", "download 3", "download-decoded 3"]);
  });

  it("leaves out a backup that is still running (no manifest yet)", async () => {
    const seen: { url: URL; auth: string | null }[] = [];
    const client = createProxmoxClient({ baseUrl: "https://pbs:8007", authorization: "PBSAPIToken=a:b", label: "pbs", fetchImpl: usageFetch(seen, { 1: [1] }) });
    const running = new Map([
      ["vm/100/1", snapFiles],
      ["vm/100/2", ["qemu-server.conf.blob", "drive-scsi0.img.fidx"]],
    ]);
    const result = await fetchPbsUsage(client, "nas-backups", "streamwizard", [snapshot(1), snapshot(2)], running, null, 100);
    expect([...result.snapshots.keys()]).toEqual(["vm/100/1"]);
    expect(seen.every((s) => s.url.searchParams.get("backup-time") === "1")).toBe(true);
  });
});

describe("proxmox client raw downloads", () => {
  it("stops past the byte limit", async () => {
    const client = createProxmoxClient({
      baseUrl: "https://pbs:8007",
      authorization: "PBSAPIToken=a:b",
      label: "pbs",
      fetchImpl: (async () => new Response(new Uint8Array(100), { status: 200 })) as unknown as typeof fetch,
    });
    await expect(client.getRaw("/x", {}, { maxBytes: 50 })).rejects.toThrow("byte limit");
    expect((await client.getRaw("/x", {}, { maxBytes: 100 })).byteLength).toBe(100);
  });
});
