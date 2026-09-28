import { describe, expect, it } from "bun:test";
import { computeBackupOverview } from "./status";
import type { BackupEventLite, BackupPollData, PbsSnapshot } from "./types";

const NOW = new Date("2026-09-28T12:00:00Z");
const nowSec = NOW.getTime() / 1000;
const H = 3600;
const recent = new Date(NOW.getTime() - 60_000).toISOString();
const healthy = { okAt: recent, attemptAt: recent, error: null, failingSince: null };

function snap(id: string, hoursAgo: number, verification: PbsSnapshot["verification"] = "ok"): PbsSnapshot {
  return { type: "vm", id, time: nowSec - hoursAgo * H, sizeBytes: 1000, comment: `vm-${id}`, verification, protected: false };
}

function poll(snapshots: PbsSnapshot[], overrides: Partial<BackupPollData> = {}): BackupPollData {
  return {
    version: 1,
    datastore: "nas-backups",
    namespace: "streamwizard",
    pbs: {
      health: healthy,
      data: {
        datastore: { totalBytes: 100, usedBytes: 50, availBytes: 50 },
        snapshots,
        gc: { id: "nas-backups", kind: "gc", state: "ok", stateText: "OK", lastRunAt: nowSec - 5 * H, nextRunAt: null, schedule: "daily" },
        verifyJobs: [{ id: "monthly-reverify", kind: "verify", state: "ok", stateText: "OK", lastRunAt: nowSec - 10 * 24 * H, nextRunAt: null, schedule: null }],
        pruneJobs: [{ id: "daily-prune", kind: "prune", state: "ok", stateText: "OK", lastRunAt: nowSec - 6 * H, nextRunAt: null, schedule: "daily" }],
      },
    },
    pve: {
      pve1: {
        health: healthy,
        data: {
          node: "pve1",
          jobs: [{ id: "backup-sw", enabled: true, schedule: "03:00", storage: "pbs-sw", selection: "list", pool: null, vmids: [100] }],
          guests: [{ vmid: 100, name: "pfsense", type: "qemu" }],
          failedRuns: [],
        },
      },
    },
    ...overrides,
  };
}

const okEvent: BackupEventLite = {
  id: "e1",
  source: "pve1",
  eventType: "vzdump",
  jobId: "backup-sw",
  severity: "info",
  title: "backup successful",
  occurredAt: new Date(NOW.getTime() - 8 * H * 1000).toISOString(),
  receivedAt: new Date(NOW.getTime() - 8 * H * 1000).toISOString(),
  guests: [{ vmid: 100, name: "pfsense", status: "ok" }],
};

const threeGood = [snap("100", 9), snap("100", 33), snap("100", 57)];

describe("computeBackupOverview", () => {
  it("is ok when everything is recent and verified", () => {
    const o = computeBackupOverview(poll(threeGood), [okEvent], NOW);
    expect(o.vms).toHaveLength(1);
    expect(o.vms[0]).toMatchObject({ vmid: 100, name: "pfsense", host: "pve1", status: "ok", snapshotCount: 3, verification: "ok" });
    expect(o.status).toBe("ok");
  });

  it("warns after 26 h and errors after 50 h", () => {
    expect(computeBackupOverview(poll([snap("100", 30), snap("100", 54), snap("100", 78)]), [okEvent], NOW).vms[0]!.status).toBe("warning");
    expect(computeBackupOverview(poll([snap("100", 51), snap("100", 75), snap("100", 99)]), [okEvent], NOW).vms[0]!.status).toBe("error");
  });

  it("errors on failed verification, warns on long-pending verification", () => {
    expect(computeBackupOverview(poll([snap("100", 9, "failed"), ...threeGood.slice(1)]), [okEvent], NOW).vms[0]!.status).toBe("error");
    const pending = computeBackupOverview(poll([snap("100", 9, null), ...threeGood.slice(1)]), [okEvent], NOW).vms[0]!;
    expect(pending.status).toBe("warning");
    expect(pending.reasons[0]).toContain("not verified");
    const fresh = computeBackupOverview(poll([snap("100", 1, null), ...threeGood.slice(1)]), [okEvent], NOW).vms[0]!;
    expect(fresh.verification).toBe("pending");
    expect(fresh.status).toBe("ok");
  });

  it("warns on too few snapshots", () => {
    expect(computeBackupOverview(poll([snap("100", 9)]), [okEvent], NOW).vms[0]!.status).toBe("warning");
  });

  it("errors when a webhook reports a failure newer than the last snapshot", () => {
    const failed: BackupEventLite = { ...okEvent, id: "e2", severity: "error", occurredAt: new Date(NOW.getTime() - 2 * H * 1000).toISOString(), guests: [{ vmid: 100, name: "pfsense", status: "failed" }] };
    const vm = computeBackupOverview(poll(threeGood), [okEvent, failed], NOW).vms[0]!;
    expect(vm.status).toBe("error");
    expect(vm.lastEvent).toMatchObject({ status: "failed" });
  });

  it("ignores an older failure that a later snapshot superseded, even when it arrives last", () => {
    const oldFailure: BackupEventLite = { ...okEvent, id: "e0", occurredAt: new Date(NOW.getTime() - 20 * H * 1000).toISOString(), guests: [{ vmid: 100, name: "pfsense", status: "failed" }] };
    // okEvent (8 h ago) is newer by occurred_at, so it wins regardless of array order.
    const vm = computeBackupOverview(poll(threeGood), [okEvent, oldFailure], NOW).vms[0]!;
    expect(vm.status).toBe("ok");
    expect(vm.lastEvent?.status).toBe("ok");
  });

  it("errors on a failed vzdump task found through the PVE API", () => {
    const p = poll(threeGood);
    p.pve.pve1!.data!.failedRuns = [{ upid: "u", startedAt: nowSec - 2 * H, endedAt: null, status: "job errors", failedVmids: [100], coveredVmids: [100] }];
    expect(computeBackupOverview(p, [okEvent], NOW).vms[0]!.status).toBe("error");
  });

  it("errors when the VM's only job is disabled", () => {
    const p = poll(threeGood);
    p.pve.pve1!.data!.jobs[0]!.enabled = false;
    expect(computeBackupOverview(p, [okEvent], NOW).vms[0]!.reasons.join()).toContain("disabled");
  });

  it("never reports ok on stale PBS data, but keeps worse states", () => {
    const stale = { okAt: new Date(NOW.getTime() - 60 * 60_000).toISOString(), attemptAt: recent, error: "timeout", failingSince: recent };
    const good = poll(threeGood);
    good.pbs.health = stale;
    const o = computeBackupOverview(good, [okEvent], NOW);
    expect(o.vms[0]!.status).toBe("unknown");
    expect(o.checks.find((c) => c.id === "pbs-poll")!.status).toBe("error");

    const old = poll([snap("100", 60), snap("100", 84), snap("100", 108)]);
    old.pbs.health = stale;
    expect(computeBackupOverview(old, [okEvent], NOW).vms[0]!.status).toBe("error");
  });

  it("flags datastore usage, failed GC and overdue prune", () => {
    const p = poll(threeGood);
    p.pbs.data!.datastore = { totalBytes: 100, usedBytes: 91, availBytes: 9 };
    p.pbs.data!.gc!.state = "error";
    p.pbs.data!.pruneJobs[0]!.lastRunAt = nowSec - 72 * H;
    const o = computeBackupOverview(p, [okEvent], NOW);
    expect(o.checks.find((c) => c.id === "datastore-usage")!.status).toBe("error");
    expect(o.checks.find((c) => c.id === "gc")!.status).toBe("error");
    expect(o.checks.find((c) => c.id === "prune:daily-prune")!.status).toBe("error");
    expect(o.status).toBe("error");
  });

  it("warns when a host with jobs has sent no webhook", () => {
    const o = computeBackupOverview(poll(threeGood), [], NOW);
    expect(o.hosts[0]).toMatchObject({ name: "pve1", status: "warning" });
    expect(o.hosts[0]!.reasons).toContain("No webhook received yet");
  });

  it("shows a VM that is in a job but has no backups yet", () => {
    const p = poll(threeGood);
    p.pve.pve1!.data!.jobs[0]!.vmids = [100, 108];
    const vm = computeBackupOverview(p, [okEvent], NOW).vms.find((v) => v.vmid === 108)!;
    expect(vm).toMatchObject({ status: "warning", snapshotCount: 0, lastSuccessAt: null });
  });

  it("doesn't borrow a VM name from another host's guest with the same VMID", () => {
    const p = poll(threeGood);
    p.pve.pve = {
      health: healthy,
      data: { node: "pve", jobs: [], guests: [{ vmid: 100, name: "homelab-nas", type: "qemu" }], failedRuns: [] },
    };
    expect(computeBackupOverview(p, [okEvent], NOW).vms[0]!.name).toBe("pfsense");
  });

  it("is unknown with no poll data at all", () => {
    const o = computeBackupOverview(null, [], NOW);
    expect(o.status).toBe("error");
    expect(o.vms).toEqual([]);
    expect(o.checks.find((c) => c.id === "vms")!.status).toBe("unknown");
  });
});
