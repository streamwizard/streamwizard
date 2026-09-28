import { beforeEach, describe, expect, test } from "bun:test";
import type { BackupPollData } from "@repo/backups";
import type { EnvContext } from "../types";
import { backupRules, resetBackupRuleCache } from "./backup";

const NOW = new Date("2026-09-28T12:00:00Z");
const nowSec = NOW.getTime() / 1000;
const H = 3600;
const recent = new Date(NOW.getTime() - 60_000).toISOString();
const health = { okAt: recent, attemptAt: recent, error: null, failingSince: null };

function poll(): BackupPollData {
  const snap = (id: string, hoursAgo: number) => ({ type: "vm", id, time: nowSec - hoursAgo * H, sizeBytes: 1, comment: `vm-${id}`, verification: "ok" as const, protected: false });
  return {
    version: 1,
    datastore: "nas-backups",
    namespace: "streamwizard",
    pbs: {
      health,
      data: {
        datastore: { totalBytes: 100, usedBytes: 85, availBytes: 15 },
        snapshots: [snap("100", 9), snap("100", 33), snap("100", 57), snap("108", 30), snap("108", 54), snap("108", 78)],
        gc: { id: "nas-backups", kind: "gc", state: "error", stateText: "disk full", lastRunAt: nowSec - 5 * H, nextRunAt: null, schedule: null },
        verifyJobs: [],
        pruneJobs: [],
      },
    },
    pve: {
      pve1: {
        health: { okAt: new Date(NOW.getTime() - 40 * 60_000).toISOString(), attemptAt: recent, error: "timed out", failingSince: recent },
        data: {
          node: "pve1",
          jobs: [{ id: "backup-sw", enabled: true, schedule: "03:00", storage: "pbs-sw", selection: "list", pool: null, vmids: [100, 108] }],
          guests: [],
          failedRuns: [],
        },
      },
    },
  };
}

// Just enough of the Supabase client for the two reads the rules make.
function ctxWith(rows: { data: unknown }[], now: Date = NOW, onRead?: () => void): EnvContext {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: async () => ({ data: [], error: null }),
  };
  const supabase = {
    from: (table: string) =>
      table === "backup_poll_state"
        ? {
            select: async () => {
              onRead?.();
              return { data: rows, error: null };
            },
          }
        : chain,
  };
  return { env: "prod", bucket: "b", now, supabase, registry: {}, probeResults: new Map() } as unknown as EnvContext;
}

const rule = (id: string) => backupRules({}).find((r) => r.id === id)!;

describe("backup rules", () => {
  beforeEach(() => resetBackupRuleCache());

  test("stay quiet when monitoring isn't set up", async () => {
    const ctx = ctxWith([]);
    for (const r of backupRules({})) expect(await r.evaluate(ctx)).toEqual([]);
  });

  test("fire per VM on age, with tunable hours", async () => {
    const ctx = ctxWith([{ data: poll() }]);
    expect(await rule("backup.vm_stale").evaluate(ctx)).toEqual([
      { entityId: "108", severity: "warn", value: 30, message: "vm-108 (108): newest backup is 30 h old" },
    ]);
    const tighter = backupRules({ "backup.vm_stale": { warn: 8 } }).find((r) => r.id === "backup.vm_stale")!;
    expect((await tighter.evaluate(ctxWith([{ data: poll() }]))).map((b) => b.entityId)).toEqual(["108", "100"]);
  });

  test("datastore usage, PBS jobs and unreachable hosts", async () => {
    const ctx = ctxWith([{ data: poll() }]);
    expect((await rule("backup.datastore_usage").evaluate(ctx))[0]).toMatchObject({ severity: "warn", entityId: "nas-backups" });
    expect((await rule("backup.pbs_jobs").evaluate(ctx))[0]).toMatchObject({ severity: "crit", entityId: "gc:nas-backups" });
    const unreachable = await rule("backup.source_unreachable").evaluate(ctx);
    expect(unreachable.map((b) => b.entityId)).toEqual(["pve1"]);
    expect(unreachable[0]!.message).toContain("timed out");
  });

  test("reuse the rows for 3 minutes", async () => {
    let reads = 0;
    const counting = (now: Date) => ctxWith([{ data: poll() }], now, () => reads++);
    const stale = rule("backup.vm_stale");
    await stale.evaluate(counting(NOW));
    const later = await stale.evaluate(counting(new Date(NOW.getTime() + 2 * 60_000)));
    expect(reads).toBe(1);
    expect(later[0]?.entityId).toBe("108");
    await stale.evaluate(counting(new Date(NOW.getTime() + 4 * 60_000)));
    expect(reads).toBe(2);
  });

  test("run only in prod by default", () => {
    for (const r of backupRules({})) expect(r.envs).toEqual(["prod"]);
  });
});
