import { describe, expect, it } from "bun:test";
import type { BackupPollData } from "./types";
import { classifyEvent, jobLevelGuests, parseVzdumpGuests } from "./webhook";

const health = { okAt: null, attemptAt: null, error: null, failingSince: null };
const poll: BackupPollData = {
  version: 1,
  datastore: "nas-backups",
  namespace: "streamwizard",
  pbs: {
    health,
    data: {
      datastore: null,
      snapshots: [],
      gc: null,
      verifyJobs: [{ id: "monthly-reverify", kind: "verify", state: "ok", stateText: "OK", lastRunAt: null, nextRunAt: null, schedule: null }],
      pruneJobs: [{ id: "daily-prune", kind: "prune", state: "ok", stateText: "OK", lastRunAt: null, nextRunAt: null, schedule: null }],
    },
  },
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
    pve: { health, data: null },
  },
};

describe("classifyEvent", () => {
  const key = (over: Partial<Parameters<typeof classifyEvent>[1]>) => ({ source: "pve1", type: "vzdump", jobId: "backup-sw", datastore: null, ...over });

  it("accepts our vzdump job and rejects other jobs and manual runs", () => {
    expect(classifyEvent(poll, key({}))).toBe("ours");
    expect(classifyEvent(poll, key({ jobId: "backup-homelab" }))).toBe("not-ours");
    expect(classifyEvent(poll, key({ jobId: null }))).toBe("not-ours");
    expect(classifyEvent(poll, key({ source: "stranger" }))).toBe("not-ours");
  });

  it("is unknown until discovery has run for that host", () => {
    expect(classifyEvent(poll, key({ source: "pve" }))).toBe("unknown");
    expect(classifyEvent(null, key({}))).toBe("unknown");
  });

  it("filters PBS jobs by datastore and discovered job id", () => {
    expect(classifyEvent(poll, { source: "pbs", type: "gc", jobId: null, datastore: "nas-backups" })).toBe("ours");
    expect(classifyEvent(poll, { source: "pbs", type: "gc", jobId: null, datastore: "other" })).toBe("not-ours");
    expect(classifyEvent(poll, { source: "pbs", type: "verify", jobId: "monthly-reverify", datastore: "nas-backups" })).toBe("ours");
    expect(classifyEvent(poll, { source: "pbs", type: "verify", jobId: "homelab-verify", datastore: "nas-backups" })).toBe("not-ours");
    expect(classifyEvent(poll, { source: "pbs", type: "prune", jobId: "daily-prune", datastore: "nas-backups" })).toBe("ours");
    expect(classifyEvent(poll, { source: "pbs", type: "sync", jobId: "x", datastore: "nas-backups" })).toBe("not-ours");
  });
});

describe("parseVzdumpGuests", () => {
  it("reads the details table", () => {
    const message = [
      "Details",
      "=======",
      "VMID    Name         Status    Time       Size           Filename",
      "100     pfsense      ok        1min 2s    1.2 GiB        vm/100/2026-09-28T01:00:02Z",
      "102     mc-node-1    err       3s         0 B            null",
      "",
      "Total running time: 1min 5s",
    ].join("\n");
    expect(parseVzdumpGuests(message)).toEqual([
      { vmid: 100, name: "pfsense", status: "ok" },
      { vmid: 102, name: "mc-node-1", status: "failed" },
    ]);
  });

  it("falls back to log lines", () => {
    const message = "INFO: Finished Backup of VM 100 (00:01:02)\nERROR: Backup of VM 102 failed - timeout";
    expect(parseVzdumpGuests(message)).toEqual([
      { vmid: 100, name: null, status: "ok" },
      { vmid: 102, name: null, status: "failed" },
    ]);
  });

  it("returns null when nothing parses", () => {
    expect(parseVzdumpGuests("job failed before starting")).toBeNull();
  });
});

describe("jobLevelGuests", () => {
  it("marks every guest of the job with the job result", () => {
    expect(jobLevelGuests(poll, "pve1", "backup-sw", "error")).toEqual([
      { vmid: 100, name: null, status: "failed" },
      { vmid: 102, name: null, status: "failed" },
    ]);
    expect(jobLevelGuests(poll, "pve1", "unknown-job", "info")).toBeNull();
  });
});
