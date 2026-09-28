import { describe, expect, it } from "bun:test";
import {
  findOurStorages,
  jobCoversNamespace,
  jobRunState,
  toPbsJobs,
  toPbsSnapshots,
  toPveFailedRun,
  toPveGuests,
  toPveJobs,
} from "./normalize";

describe("jobRunState", () => {
  it("maps Proxmox last-run-state strings", () => {
    expect(jobRunState("OK")).toBe("ok");
    expect(jobRunState("WARNINGS: 2")).toBe("warning");
    expect(jobRunState("verification failed - please check the log for details")).toBe("error");
    expect(jobRunState(undefined)).toBe("unknown");
  });
});

describe("PBS job namespace filter", () => {
  it("keeps whole-store and own-namespace jobs, drops other namespaces", () => {
    expect(jobCoversNamespace(undefined, "streamwizard")).toBe(true);
    expect(jobCoversNamespace("", "streamwizard")).toBe(true);
    expect(jobCoversNamespace("streamwizard", "streamwizard")).toBe(true);
    expect(jobCoversNamespace("homelab", "streamwizard")).toBe(false);
    expect(jobCoversNamespace("stream", "streamwizard")).toBe(false);
  });

  it("filters jobs by store, namespace and disable", () => {
    const jobs = toPbsJobs(
      [
        { id: "monthly-reverify", store: "nas-backups", ns: "streamwizard", "last-run-state": "OK", "last-run-endtime": 100 },
        { id: "homelab-verify", store: "nas-backups", ns: "homelab" },
        { id: "other-store", store: "other" },
        { id: "store-wide", store: "nas-backups" },
        { id: "off", store: "nas-backups", disable: true },
      ],
      "verify",
      "nas-backups",
      "streamwizard",
    );
    expect(jobs.map((j) => j.id)).toEqual(["monthly-reverify", "store-wide"]);
    expect(jobs[0]).toMatchObject({ kind: "verify", state: "ok", lastRunAt: 100 });
  });
});

describe("toPbsSnapshots", () => {
  it("normalises verification and keeps only the first comment line", () => {
    const [snap] = toPbsSnapshots([
      { "backup-type": "vm", "backup-id": "103", "backup-time": 1000, size: 42, comment: "obs-node-1\nmore notes", verification: { state: "failed" } },
    ]);
    expect(snap).toEqual({ type: "vm", id: "103", time: 1000, sizeBytes: 42, comment: "obs-node-1", verification: "failed", protected: false });
  });
});

describe("PVE discovery", () => {
  const storages = [
    { storage: "pbs-sw", type: "pbs", datastore: "nas-backups", namespace: "streamwizard" },
    { storage: "pbs-home", type: "pbs", datastore: "nas-backups", namespace: "homelab" },
    { storage: "local", type: "dir" },
  ];
  const guests = toPveGuests(
    [
      { vmid: 100, name: "pfsense" },
      { vmid: 102, name: "mc-node-1" },
      { vmid: 9000, name: "template", template: 1 },
    ],
    [{ vmid: "200", name: "homelab-ct" }],
  );

  it("finds only storages that write to our namespace", () => {
    expect(findOurStorages(storages, "nas-backups", "streamwizard")).toEqual(["pbs-sw"]);
  });

  it("resolves vmid lists, all+exclude, pools, and enabled defaults", () => {
    const jobs = toPveJobs(
      [
        { id: "backup-sw", storage: "pbs-sw", vmid: "100,102", schedule: "03:00" },
        { id: "backup-all", storage: "pbs-sw", all: 1, exclude: "200", enabled: 0 },
        { id: "backup-pool", storage: "pbs-sw", pool: "sw" },
        { id: "backup-home", storage: "pbs-home", vmid: "200" },
        { id: "backup-other-node", storage: "pbs-sw", vmid: "104", node: "pve" },
      ],
      ["pbs-sw"],
      "pve1",
      guests,
    );
    expect(jobs.map((j) => [j.id, j.enabled, j.selection, j.vmids])).toEqual([
      ["backup-sw", true, "list", [100, 102]],
      ["backup-all", false, "all", [100, 102]],
      ["backup-pool", true, "pool", []],
    ]);
  });

  it("skips templates when listing guests", () => {
    expect(guests.map((g) => g.vmid)).toEqual([100, 102, 200]);
  });
});

describe("toPveFailedRun", () => {
  const task = { upid: "UPID:pve1:1", type: "vzdump", starttime: 500, endtime: 900, status: "job errors" };

  it("reports our failed guests from the task log", () => {
    const run = toPveFailedRun(
      task,
      [
        "INFO: Starting Backup of VM 100 (qemu)",
        "INFO: Finished Backup of VM 100 (00:01:02)",
        "INFO: Starting Backup of VM 102 (qemu)",
        "ERROR: Backup of VM 102 failed - unable to connect to PBS",
      ],
      new Set([100, 102]),
    );
    expect(run).toEqual({ upid: "UPID:pve1:1", startedAt: 500, endedAt: 900, status: "job errors", failedVmids: [102], coveredVmids: [100, 102] });
  });

  it("drops tasks that touched none of our guests", () => {
    const run = toPveFailedRun(task, ["INFO: Starting Backup of VM 200 (lxc)", "ERROR: Backup of VM 200 failed - boom"], new Set([100]));
    expect(run).toBeNull();
  });
});
