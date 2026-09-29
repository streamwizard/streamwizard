import { beforeEach, describe, expect, mock, test } from "bun:test";
import type { ProxmoxGuestLatest, ProxmoxNodeLatest, ProxmoxStorage } from "@repo/metrics";
import type { EnvContext, ProxmoxVmAlertSetting, Registry } from "../types";

let influxGuests: ProxmoxGuestLatest[] = [];
let influxNodes: ProxmoxNodeLatest[] = [];
let influxStorages: ProxmoxStorage[] = [];
let influxReads = 0;
// Keep every other export real: bun's module mocks are process-wide, and
// other test files import @repo/metrics too.
const realMetrics = await import("@repo/metrics");
mock.module("@repo/metrics", () => ({
  ...realMetrics,
  queryLatestProxmoxGuests: async () => {
    influxReads++;
    return influxGuests;
  },
  queryLatestProxmoxNodes: async () => {
    influxReads++;
    return influxNodes;
  },
  queryProxmoxStorages: async () => {
    influxReads++;
    return influxStorages;
  },
}));

const { VM_ALERT_RULES, isStreamwizardVm, proxmoxGuestName, proxmoxRules, storagesToWatch } = await import("./proxmox");

const NOW = new Date("2026-09-29T12:00:00Z");
const ago = (min: number) => new Date(NOW.getTime() - min * 60_000).toISOString();

const guest = (over: Partial<ProxmoxGuestLatest> = {}): ProxmoxGuestLatest => ({
  nodename: "pve1",
  vmid: 100,
  name: "web",
  type: "qemu",
  time: ago(0),
  status: "running",
  tags: ["streamwizard"],
  fields: {},
  ...over,
});

const node = (over: Partial<ProxmoxNodeLatest> = {}): ProxmoxNodeLatest => ({
  host: "pve1",
  time: ago(0),
  fields: {},
  ...over,
});

const storage = (over: Partial<ProxmoxStorage> = {}): ProxmoxStorage => ({
  key: "pve1:local",
  nodename: "pve1",
  storage: "local",
  type: "dir",
  total: 100,
  used: 10,
  avail: 90,
  active: true,
  enabled: true,
  shared: false,
  content: "iso",
  time: ago(0),
  ...over,
});

const optIn = (vmid: number, ...rules: string[]): ProxmoxVmAlertSetting => ({ host: "pve1", vmid, rules });

function ctxWith(settings: ProxmoxVmAlertSetting[] = []): EnvContext {
  return {
    env: "prod",
    now: NOW,
    supabase: {},
    registry: { proxmoxVmAlertSettings: settings } as Partial<Registry>,
    probeResults: new Map(),
  } as unknown as EnvContext;
}

const rule = (id: string) => proxmoxRules({}).find((r) => r.id === id)!;

describe("proxmox rules", () => {
  beforeEach(() => {
    influxGuests = [];
    influxNodes = [node()];
    influxStorages = [];
    influxReads = 0;
  });

  test("vm.down fires only for VMs that are tagged and opted in", async () => {
    influxGuests = [
      guest({ status: "stopped" }),
      guest({ vmid: 101, name: "db", status: "stopped" }),
      guest({ vmid: 102, name: "personal", status: "stopped", tags: [] }),
    ];
    const breaches = await rule("vm.down").evaluate(ctxWith([optIn(100, "vm.down"), optIn(102, "vm.down")]));
    expect(breaches).toEqual([{ entityId: "pve1:100", severity: "crit", message: "web (pve1/100) is stopped" }]);
    expect(proxmoxGuestName("pve1:100")).toEqual({ name: "web", host: "pve1" });
    expect(isStreamwizardVm(["a", "streamwizard"])).toBe(true);
    expect(isStreamwizardVm([])).toBe(false);
  });

  test("vm.down catches a guest that stopped reporting, but not while its node is silent", async () => {
    influxGuests = [guest({ time: ago(12) }), guest({ nodename: "pve2", time: ago(12) })];
    influxNodes = [node(), node({ host: "pve2", time: ago(12) })];
    const breaches = await rule("vm.down").evaluate(ctxWith([optIn(100, "vm.down"), { host: "pve2", vmid: 100, rules: ["vm.down"] }]));
    expect(breaches).toEqual([
      { entityId: "pve1:100", severity: "crit", value: 720, message: "web (pve1/100) not reported by Proxmox for 12 min" },
    ]);
  });

  test("threshold rules only read opted-in, running guests, with one Influx read per tick", async () => {
    influxGuests = [
      guest({ fields: { cpu: 0.9, mem: 95, maxmem: 100, pressureiosome: 45 } }),
      guest({ vmid: 101, fields: { cpu: 0.99 } }),
      guest({ vmid: 102, status: "stopped", fields: { cpu: 0.99 } }),
    ];
    const ctx = ctxWith([optIn(100, "vm.cpu_high", "vm.mem_high", "vm.io_pressure_high"), optIn(102, "vm.cpu_high")]);
    const cpu = await rule("vm.cpu_high").evaluate(ctx);
    const mem = await rule("vm.mem_high").evaluate(ctx);
    const io = await rule("vm.io_pressure_high").evaluate(ctx);
    expect(cpu.map((b) => [b.entityId, b.severity])).toEqual([["pve1:100", "warn"]]);
    expect(cpu[0]?.message).toBe("CPU on web (pve1/100) at 90% (warn > 85%)");
    expect(mem.map((b) => [b.entityId, b.severity])).toEqual([["pve1:100", "warn"]]);
    expect(io.map((b) => [b.entityId, b.severity])).toEqual([["pve1:100", "crit"]]);
    // One guest read and one node read shared by the three rules.
    expect(influxReads).toBe(2);

    const tuned = proxmoxRules({ "vm.cpu_high": { enabled: true, warn: 95, crit: null, forTicks: null, envs: null } });
    expect(await tuned.find((r) => r.id === "vm.cpu_high")!.evaluate(ctxWith([optIn(100, "vm.cpu_high")]))).toEqual([]);
  });

  test("host CPU and RAM rules are always on and skip silent nodes", async () => {
    influxNodes = [
      node({ fields: { cpu: 0.9, memused: 98, memtotal: 100 } }),
      node({ host: "pve2", time: ago(20), fields: { cpu: 0.99, memused: 99, memtotal: 100 } }),
    ];
    const cpu = await rule("vm.host_cpu_high").evaluate(ctxWith());
    const mem = await rule("vm.host_mem_high").evaluate(ctxWith());
    expect(cpu.map((b) => [b.entityId, b.severity])).toEqual([["pve1", "warn"]]);
    expect(mem.map((b) => [b.entityId, b.severity])).toEqual([["pve1", "crit"]]);
  });

  test("vm.host_unreachable fires for a node silent over 90 s", async () => {
    influxNodes = [node(), node({ host: "pve2", time: ago(1.6) }), node({ host: "pve3", time: ago(1.4) })];
    expect(await rule("vm.host_unreachable").evaluate(ctxWith())).toEqual([
      { entityId: "pve2", severity: "crit", value: 96, message: "Proxmox host pve2 hasn't reported for 96 s" },
    ]);
  });

  test("vm.down and vm.host_unreachable fire on the first tick", () => {
    expect(rule("vm.down").forTicks).toBe(1);
    expect(rule("vm.host_unreachable").forTicks).toBe(1);
  });

  test("vm.storage_high watches local storages, skips PBS, inactive, repeated shared ones and silent nodes", async () => {
    influxStorages = [
      storage({ used: 88 }),
      storage({ key: "pve1:local-lvm", storage: "local-lvm", type: "lvmthin", used: 96 }),
      storage({ key: "pve1:pbs", storage: "pbs", type: "pbs", used: 99, shared: true }),
      storage({ key: "pve1:old", storage: "old", used: 99, active: false }),
      storage({ key: "pve1:nfs", storage: "nfs", type: "nfs", used: 90, shared: true }),
      storage({ key: "pve2:nfs", nodename: "pve2", storage: "nfs", type: "nfs", used: 90, shared: true }),
      storage({ key: "pve3:local", nodename: "pve3", used: 99 }),
    ];
    influxNodes = [node(), node({ host: "pve2" }), node({ host: "pve3", time: ago(30) })];
    const breaches = await rule("vm.storage_high").evaluate(ctxWith());
    expect(breaches.map((b) => [b.entityId, b.severity])).toEqual([
      ["pve1:local", "warn"],
      ["pve1:local-lvm", "crit"],
      ["pve1:nfs", "warn"],
    ]);
    expect(breaches[0]?.message).toBe("Storage local on pve1 at 88% (warn > 85%)");
    expect(storagesToWatch([storage({ total: 0 })])).toEqual([]);
  });

  test("run only in prod by default", () => {
    for (const r of proxmoxRules({})) expect(r.envs).toEqual(["prod"]);
  });

  test("VM_ALERT_RULES lists every per-VM rule with its real title", () => {
    const alwaysOn = new Set(["vm.host_unreachable", "vm.host_cpu_high", "vm.host_mem_high", "vm.storage_high"]);
    const vmRules = proxmoxRules({}).filter((r) => !alwaysOn.has(r.id));
    expect(VM_ALERT_RULES.map((r): string[] => [r.id, r.title])).toEqual(vmRules.map((r) => [r.id, r.title]));
  });
});
