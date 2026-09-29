import { runFluxQuery, assertValidFluxDuration } from "../query-client";
import { fluxFrom } from "../buckets";

// Proxmox VE metrics for web-admin's /vms pages. Proxmox VE writes these
// itself (Datacenter → Metric Server → InfluxDB) into the proxmox bucket; our
// code never writes them. Shape: docs/proxmox-monitoring-plan.md, "InfluxDB
// schema (verified)". In short:
//   guests    object=qemu|lxc, tags host (guest name), nodename, vmid
//             system, ballooninfo, blockstat (+instance), nics (+instance)
//   nodes     object=nodes, tag host (node name), no nodename
//             system (uptime), cpustat, memory, blockstat (root fs), nics (+instance)
//   storages  object=storages, measurement system, tags host (storage name),
//             nodename, type
// PVE node names equal the PVE_HOSTS names, so a guest is `${nodename}:${vmid}`
// everywhere (vmids repeat across hosts).
//
// String fields (status, name, type, content, …) live inside the numeric
// measurements, so every query filters _field before any math, and never
// groups or pivots strings with numbers.

// --- Input checks: every value below lands inside Flux source. ---

const NAME_RE = /^[A-Za-z0-9._-]+$/;

/** Host, storage and drive/NIC names: letters, digits, dot, dash, underscore. */
export function assertProxmoxName(value: string, label: string): string {
  if (!NAME_RE.test(value) || value.length > 64) throw new Error(`Invalid ${label}`);
  return value;
}

function assertVmid(vmid: number): number {
  if (!Number.isInteger(vmid) || vmid <= 0 || vmid > 999_999_999) throw new Error("Invalid vmid");
  return vmid;
}

/** Series key for one guest: "<nodename>:<vmid>". */
export function proxmoxGuestKey(nodename: string, vmid: number | string): string {
  return `${nodename}:${vmid}`;
}

/** Series key for one storage: "<nodename>:<storage>". */
export function proxmoxStorageKey(nodename: string, storage: string): string {
  return `${nodename}:${storage}`;
}

/** One chart point. `nodeId` is the series label so NodeMetricChart takes it as is. */
export interface ProxmoxMetricPoint {
  time: string;
  nodeId: string;
  value: number;
}

// --- Flux building blocks ---

const fieldIn = (fields: readonly string[]) => `(${fields.map((f) => `r._field == "${f}"`).join(" or ")})`;

/** `(r._measurement == m and (r._field == …))`, for picking fields per measurement. */
const pick = (measurement: string, fields: readonly string[]) => `(r._measurement == "${measurement}" and ${fieldIn(fields)})`;

const any = (predicates: string[]) => predicates.join(" or ");

const num = (v: string | undefined): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

interface SeriesRow {
  time: string;
  measurement: string;
  field: string;
  object: string;
  /** PVE's host tag: guest, node or storage name. */
  host: string;
  nodename: string;
  vmid: string;
  /** Drive (blockstat) or NIC (nics); "" when the series has none. */
  instance: string;
  value: number;
}

const toSeriesRow = (row: Record<string, string>): SeriesRow => ({
  time: row._time ?? "",
  measurement: row._measurement ?? "",
  field: row._field ?? "",
  object: row.object ?? "",
  host: row.host ?? "",
  nodename: row.nodename ?? "",
  vmid: row.vmid ?? "",
  instance: row.instance ?? "",
  value: Number(row._value),
});

/**
 * One round trip for a page's worth of series, each pipeline on its own
 * fields:
 * - gauges: averaged per window
 * - rates:  counters → per second with derivative(), averaged per window
 * - deltas: counters → increase per window (for ratios like CPU breakdown)
 * `base` narrows the read (one guest, one node) before any of that.
 */
async function querySeries(opts: {
  range: string;
  window: string;
  base: string;
  gauges?: string[];
  rates?: string[];
  deltas?: string[];
}): Promise<SeriesRow[]> {
  const { range, window } = opts;
  assertValidFluxDuration(range, "range");
  assertValidFluxDuration(window, "window");
  const branches: string[] = [];
  if (opts.gauges?.length) {
    branches.push(`gauges = data
  |> filter(fn: (r) => ${any(opts.gauges)})
  |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)`);
  }
  if (opts.rates?.length) {
    branches.push(`rates = data
  |> filter(fn: (r) => ${any(opts.rates)})
  |> derivative(unit: 1s, nonNegative: true)
  |> aggregateWindow(every: ${window}, fn: mean, createEmpty: false)`);
  }
  if (opts.deltas?.length) {
    branches.push(`deltas = data
  |> filter(fn: (r) => ${any(opts.deltas)})
  |> difference(nonNegative: true)
  |> aggregateWindow(every: ${window}, fn: sum, createEmpty: false)`);
  }
  const names = branches.map((b) => b.slice(0, b.indexOf(" ")));
  const query = `
data = ${fluxFrom("system", `-${range}`)}
  |> filter(fn: (r) => ${opts.base})
${branches.join("\n")}
${names.length === 1 ? names[0] : `union(tables: [${names.join(", ")}])`}
  |> yield(name: "series")`;
  return runFluxQuery(query, toSeriesRow);
}

/** Latest value per series (last() for gauges, mean rate over the range for
 * counters). No pivot: rows come back per field and are grouped in TS. */
async function queryLatest(opts: {
  range: string;
  base: string;
  gauges?: string[];
  rates?: string[];
}): Promise<SeriesRow[]> {
  const branches: string[] = [];
  if (opts.gauges?.length) {
    branches.push(`gauges = data
  |> filter(fn: (r) => ${any(opts.gauges)})
  |> last()`);
  }
  if (opts.rates?.length) {
    // mean() drops _time; keep the window's stop as a stand-in.
    branches.push(`rates = data
  |> filter(fn: (r) => ${any(opts.rates)})
  |> derivative(unit: 1s, nonNegative: true)
  |> mean()
  |> duplicate(column: "_stop", as: "_time")`);
  }
  const names = branches.map((b) => b.slice(0, b.indexOf(" ")));
  const query = `
data = ${fluxFrom("system", `-${opts.range}`)}
  |> filter(fn: (r) => ${opts.base})
${branches.join("\n")}
${names.length === 1 ? names[0] : `union(tables: [${names.join(", ")}])`}
  |> yield(name: "latest")`;
  return runFluxQuery(query, toSeriesRow);
}

const GUEST_BASE = `(r.object == "qemu" or r.object == "lxc")`;
const guestBase = (nodename: string, vmid: number) =>
  `r.nodename == "${assertProxmoxName(nodename, "host")}" and r.vmid == "${assertVmid(vmid)}"`;
const nodeBase = (host: string) => `r.object == "nodes" and r.host == "${assertProxmoxName(host, "host")}"`;

const point = (row: SeriesRow, nodeId: string, value = row.value): ProxmoxMetricPoint => ({ time: row.time, nodeId, value });

// ============================================================================
// Guests
// ============================================================================

export interface ProxmoxGuestSnapshot {
  /** proxmoxGuestKey(nodename, vmid). */
  key: string;
  /** PVE node name, equal to the PVE_HOSTS name. */
  nodename: string;
  vmid: number;
  name: string;
  type: "qemu" | "lxc";
  cpuPct: number | null;
  cpus: number | null;
  /** PVE's mem: balloon total − free, so it counts the guest's page cache
   * as used. Higher than what top/htop inside the guest shows. */
  memUsed: number | null;
  memMax: number | null;
  /** RAM the QEMU process holds on the host (memhost); often equals memMax. */
  memHost: number | null;
  /** Balloon target in bytes; equals memMax when ballooning is off. */
  balloon: number | null;
  /** PVE's own disk numbers: real for lxc, 0 for qemu. */
  diskUsed: number | null;
  diskMax: number | null;
  uptimeS: number | null;
  /** PSI "some" pressure, percent. */
  pressureCpu: number | null;
  pressureIo: number | null;
  pressureMem: number | null;
  netInBps: number | null;
  netOutBps: number | null;
  diskReadBps: number | null;
  diskWriteBps: number | null;
  time: string;
}

const SNAPSHOT_GAUGES = [
  "cpu",
  "cpus",
  "mem",
  "maxmem",
  "memhost",
  "balloon",
  "disk",
  "maxdisk",
  "uptime",
  "pressurecpusome",
  "pressureiosome",
  "pressurememorysome",
] as const;
const SNAPSHOT_RATES = ["netin", "netout", "diskread", "diskwrite"] as const;

/** Groups latest rows per key into { field: value }. */
function collect<T extends { fields: Record<string, number>; time: string }>(
  rows: SeriesRow[],
  keyOf: (row: SeriesRow) => string,
  init: (row: SeriesRow) => T,
): Map<string, T> {
  const out = new Map<string, T>();
  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const key = keyOf(row);
    let entry = out.get(key);
    if (!entry) {
      entry = init(row);
      out.set(key, entry);
    }
    entry.fields[row.field] = row.value;
    if (row.time > entry.time) entry.time = row.time;
  }
  return out;
}

/**
 * Latest reading of every guest: gauges from the last 3 minutes (PVE pushes
 * every 10 s), rates averaged over the same 3 minutes. Optionally one host.
 */
export async function queryProxmoxGuestSnapshot(nodename?: string): Promise<ProxmoxGuestSnapshot[]> {
  const base = nodename ? `${GUEST_BASE} and r.nodename == "${assertProxmoxName(nodename, "host")}"` : GUEST_BASE;
  const rows = await queryLatest({
    range: "3m",
    base,
    gauges: [pick("system", SNAPSHOT_GAUGES)],
    rates: [pick("system", SNAPSHOT_RATES)],
  });
  const guests = collect(
    rows,
    (r) => proxmoxGuestKey(r.nodename, r.vmid),
    (r) => ({ nodename: r.nodename, vmid: Number(r.vmid), name: r.host, object: r.object, time: "", fields: {} as Record<string, number> }),
  );
  return [...guests.entries()].map(([key, g]) => {
    const f = (name: string) => g.fields[name] ?? null;
    const cpu = f("cpu");
    return {
      key,
      nodename: g.nodename,
      vmid: g.vmid,
      name: g.name,
      type: g.object === "lxc" ? "lxc" : "qemu",
      cpuPct: cpu === null ? null : cpu * 100,
      cpus: f("cpus"),
      memUsed: f("mem"),
      memMax: f("maxmem"),
      memHost: f("memhost"),
      balloon: f("balloon"),
      diskUsed: f("disk"),
      diskMax: f("maxdisk"),
      uptimeS: f("uptime"),
      pressureCpu: f("pressurecpusome"),
      pressureIo: f("pressureiosome"),
      pressureMem: f("pressurememorysome"),
      netInBps: f("netin"),
      netOutBps: f("netout"),
      diskReadBps: f("diskread"),
      diskWriteBps: f("diskwrite"),
      time: g.time,
    };
  });
}

export interface ProxmoxGuestSparkline {
  key: string;
  /** CPU %, one value per window, oldest first. */
  cpu: number[];
  /** Network in + out, bytes/s, one value per window. */
  net: number[];
}

/** Small per-guest trend lines for the /vms tables, all guests in one query. */
export async function queryProxmoxGuestSparklines(range = "1h", window = "5m", nodename?: string): Promise<ProxmoxGuestSparkline[]> {
  const base = nodename ? `${GUEST_BASE} and r.nodename == "${assertProxmoxName(nodename, "host")}"` : GUEST_BASE;
  const rows = await querySeries({
    range,
    window,
    base,
    gauges: [pick("system", ["cpu"])],
    rates: [pick("system", ["netin", "netout"])],
  });
  const byGuest = new Map<string, { cpu: Map<string, number>; net: Map<string, number> }>();
  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const key = proxmoxGuestKey(row.nodename, row.vmid);
    let g = byGuest.get(key);
    if (!g) {
      g = { cpu: new Map(), net: new Map() };
      byGuest.set(key, g);
    }
    if (row.field === "cpu") g.cpu.set(row.time, row.value * 100);
    else g.net.set(row.time, (g.net.get(row.time) ?? 0) + row.value);
  }
  const ordered = (m: Map<string, number>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  return [...byGuest.entries()].map(([key, g]) => ({ key, cpu: ordered(g.cpu), net: ordered(g.net) }));
}

export interface ProxmoxGuestInfo {
  status: string | null;
  /** QEMU's own state (running, paused, prelaunch, …). */
  qmpstatus: string | null;
  qemuVersion: string | null;
  machine: string | null;
  /** Config lock (backup, migrate, snapshot, …); null when not locked. */
  lock: string | null;
  tags: string | null;
  cpus: number | null;
  maxmem: number | null;
  pid: number | null;
  time: string;
}

const INFO_STRINGS = ["status", "qmpstatus", "running-qemu", "running-machine", "lock", "tags"] as const;
const INFO_NUMBERS = ["cpus", "maxmem", "pid"] as const;

/** Text facts from PVE's latest push for one guest. Fields missing from the
 * newest push (lock, tags) count as unset, not as their older value. */
export async function queryProxmoxGuestInfo(nodename: string, vmid: number): Promise<ProxmoxGuestInfo | null> {
  const query = `
${fluxFrom("system", "-15m")}
  |> filter(fn: (r) => ${guestBase(nodename, vmid)})
  |> filter(fn: (r) => r._measurement == "system" and ${fieldIn([...INFO_STRINGS, ...INFO_NUMBERS])})
  |> last()
  |> map(fn: (r) => ({ _time: r._time, _field: r._field, _value: string(v: r._value) }))
  |> yield(name: "info")`;
  const rows = await runFluxQuery(query, (row) => ({ time: row._time ?? "", field: row._field ?? "", value: row._value ?? "" }));
  if (rows.length === 0) return null;
  const newest = rows.reduce((t, r) => (r.time > t ? r.time : t), "");
  // A push lands at one timestamp; allow a second of slack.
  const cutoff = new Date(Date.parse(newest) - 1000).toISOString();
  const fresh = new Map(rows.filter((r) => r.time >= cutoff).map((r) => [r.field, r.value]));
  const text = (f: string) => fresh.get(f) || null;
  return {
    status: text("status"),
    qmpstatus: text("qmpstatus"),
    qemuVersion: text("running-qemu"),
    machine: text("running-machine"),
    lock: text("lock"),
    tags: text("tags"),
    cpus: num(fresh.get("cpus")),
    maxmem: num(fresh.get("maxmem")),
    pid: num(fresh.get("pid")),
    time: newest,
  };
}

/** Every chart on the guest page, keyed by the chart's dataKey. */
export interface ProxmoxGuestHistory {
  /** "CPU", percent of the guest's vCPUs. */
  cpu: ProxmoxMetricPoint[];
  /** Bytes: "Used (incl. cache)", "Held on host", "Max", "Balloon target",
   * "Balloon actual", "Free in guest". Balloon series only exist for VMs
   * with the balloon driver reporting stats. */
  memory: ProxmoxMetricPoint[];
  /** PSI percent: "Some", "Full". */
  pressureCpu: ProxmoxMetricPoint[];
  pressureIo: ProxmoxMetricPoint[];
  pressureMemory: ProxmoxMetricPoint[];
  /** Bytes/s over all NICs: "In", "Out". */
  net: ProxmoxMetricPoint[];
  /** Bytes/s over all drives: "Read", "Write". */
  diskIo: ProxmoxMetricPoint[];
  /** Guest swap, bytes/s: "In", "Out" (balloon driver stats). */
  swap: ProxmoxMetricPoint[];
  /** Per second: "Major", "Minor". */
  pageFaults: ProxmoxMetricPoint[];
  /** Per drive, "<drive> read" / "<drive> write": bytes/s, ops/s and ms per op. */
  driveBytes: ProxmoxMetricPoint[];
  driveIops: ProxmoxMetricPoint[];
  driveLatency: ProxmoxMetricPoint[];
  /** Per NIC, bytes/s: "<nic> in" / "<nic> out". */
  nics: ProxmoxMetricPoint[];
}

const GUEST_SYSTEM_GAUGES: Record<string, [keyof ProxmoxGuestHistory, string]> = {
  mem: ["memory", "Used (incl. cache)"],
  memhost: ["memory", "Held on host"],
  maxmem: ["memory", "Max"],
  balloon: ["memory", "Balloon target"],
  freemem: ["memory", "Free in guest"],
  pressurecpusome: ["pressureCpu", "Some"],
  pressurecpufull: ["pressureCpu", "Full"],
  pressureiosome: ["pressureIo", "Some"],
  pressureiofull: ["pressureIo", "Full"],
  pressurememorysome: ["pressureMemory", "Some"],
  pressurememoryfull: ["pressureMemory", "Full"],
};
const GUEST_SYSTEM_RATES: Record<string, [keyof ProxmoxGuestHistory, string]> = {
  netin: ["net", "In"],
  netout: ["net", "Out"],
  diskread: ["diskIo", "Read"],
  diskwrite: ["diskIo", "Write"],
};
const GUEST_BALLOON_RATES: Record<string, [keyof ProxmoxGuestHistory, string]> = {
  mem_swapped_in: ["swap", "In"],
  mem_swapped_out: ["swap", "Out"],
  major_page_faults: ["pageFaults", "Major"],
  minor_page_faults: ["pageFaults", "Minor"],
};
const DRIVE_RATES = ["rd_bytes", "wr_bytes", "rd_operations", "wr_operations", "rd_total_time_ns", "wr_total_time_ns"] as const;

export function emptyGuestHistory(): ProxmoxGuestHistory {
  return {
    cpu: [],
    memory: [],
    pressureCpu: [],
    pressureIo: [],
    pressureMemory: [],
    net: [],
    diskIo: [],
    swap: [],
    pageFaults: [],
    driveBytes: [],
    driveIops: [],
    driveLatency: [],
    nics: [],
  };
}

/** Every series for one guest's detail page, in one Influx round trip. */
export async function queryProxmoxGuestHistory(
  nodename: string,
  vmid: number,
  range = "24h",
  window = "1h",
): Promise<ProxmoxGuestHistory> {
  const rows = await querySeries({
    range,
    window,
    base: guestBase(nodename, vmid),
    gauges: [pick("system", ["cpu", ...Object.keys(GUEST_SYSTEM_GAUGES)]), pick("ballooninfo", ["actual"])],
    rates: [
      pick("system", Object.keys(GUEST_SYSTEM_RATES)),
      pick("ballooninfo", Object.keys(GUEST_BALLOON_RATES)),
      pick("blockstat", DRIVE_RATES),
      pick("nics", ["netin", "netout"]),
    ],
  });

  const out = emptyGuestHistory();
  // Per drive and time: the six rates, joined for latency and filtered for idle drives.
  const drives = new Map<string, Map<string, Record<string, number>>>();

  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const { measurement: m, field } = row;
    if (m === "system") {
      if (field === "cpu") out.cpu.push(point(row, "CPU", row.value * 100));
      const target = GUEST_SYSTEM_GAUGES[field] ?? GUEST_SYSTEM_RATES[field];
      if (target) out[target[0]].push(point(row, target[1]));
    } else if (m === "ballooninfo") {
      if (field === "actual") out.memory.push(point(row, "Balloon actual"));
      const target = GUEST_BALLOON_RATES[field];
      if (target) out[target[0]].push(point(row, target[1]));
    } else if (m === "nics" && row.instance) {
      out.nics.push(point(row, `${row.instance} ${field === "netin" ? "in" : "out"}`));
    } else if (m === "blockstat" && row.instance) {
      let byTime = drives.get(row.instance);
      if (!byTime) drives.set(row.instance, (byTime = new Map()));
      const at = byTime.get(row.time) ?? {};
      at[field] = row.value;
      byTime.set(row.time, at);
    }
  }

  for (const [drive, byTime] of [...drives.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    // An empty CD-ROM or unused drive only adds flat zero lines.
    const busy = [...byTime.values()].some((v) => (v.rd_operations ?? 0) > 0 || (v.wr_operations ?? 0) > 0);
    if (!busy) continue;
    for (const [time, v] of byTime) {
      for (const [dir, bytes, ops, ns] of [
        ["read", v.rd_bytes, v.rd_operations, v.rd_total_time_ns],
        ["write", v.wr_bytes, v.wr_operations, v.wr_total_time_ns],
      ] as const) {
        const label = `${drive} ${dir}`;
        if (bytes !== undefined) out.driveBytes.push({ time, nodeId: label, value: bytes });
        if (ops !== undefined) out.driveIops.push({ time, nodeId: label, value: ops });
        // Same window, same sample spacing: ratio of mean rates = time per op.
        if (ops !== undefined && ns !== undefined && ops > 0) {
          out.driveLatency.push({ time, nodeId: label, value: ns / ops / 1e6 });
        }
      }
    }
  }
  return out;
}

// ============================================================================
// Nodes (the PVE hosts themselves)
// ============================================================================

export interface ProxmoxNodeSnapshot {
  /** Node name, equal to the PVE_HOSTS name. */
  host: string;
  cpuPct: number | null;
  cpus: number | null;
  iowaitPct: number | null;
  load1: number | null;
  load5: number | null;
  load15: number | null;
  memTotal: number | null;
  /** PVE's used = total − available. */
  memUsed: number | null;
  memAvailable: number | null;
  memShared: number | null;
  swapTotal: number | null;
  swapUsed: number | null;
  arcSize: number | null;
  arcMax: number | null;
  rootTotal: number | null;
  rootUsed: number | null;
  rootAvail: number | null;
  uptimeS: number | null;
  time: string;
}

const NODE_CPU = ["cpu", "cpus", "wait", "avg1", "avg5", "avg15"] as const;
const NODE_MEMORY = ["memtotal", "memused", "memavailable", "memshared", "swaptotal", "swapused", "arcsize", "arcmax"] as const;
const NODE_ROOT = ["blocks", "used", "bavail"] as const;

/** Latest reading of every PVE node, optionally one. */
export async function queryProxmoxNodeSnapshot(host?: string): Promise<ProxmoxNodeSnapshot[]> {
  const base = host ? nodeBase(host) : `r.object == "nodes"`;
  const rows = await queryLatest({
    range: "3m",
    base,
    gauges: [pick("cpustat", NODE_CPU), pick("memory", NODE_MEMORY), pick("blockstat", NODE_ROOT), pick("system", ["uptime"])],
  });
  const nodes = collect(
    rows,
    (r) => r.host,
    (r) => ({ host: r.host, time: "", fields: {} as Record<string, number> }),
  );
  // blockstat "used" and memory fields share no names, but keep them apart anyway.
  const root = collect(
    rows.filter((r) => r.measurement === "blockstat"),
    (r) => r.host,
    (r) => ({ host: r.host, time: "", fields: {} as Record<string, number> }),
  );
  return [...nodes.values()].map((n) => {
    const f = (name: string) => n.fields[name] ?? null;
    const r = (name: string) => root.get(n.host)?.fields[name] ?? null;
    const pct = (v: number | null) => (v === null ? null : v * 100);
    return {
      host: n.host,
      cpuPct: pct(f("cpu")),
      cpus: f("cpus"),
      iowaitPct: pct(f("wait")),
      load1: f("avg1"),
      load5: f("avg5"),
      load15: f("avg15"),
      memTotal: f("memtotal"),
      memUsed: f("memused"),
      memAvailable: f("memavailable"),
      memShared: f("memshared"),
      swapTotal: f("swaptotal"),
      swapUsed: f("swapused"),
      arcSize: f("arcsize"),
      arcMax: f("arcmax"),
      rootTotal: r("blocks"),
      rootUsed: r("used"),
      rootAvail: r("bavail"),
      uptimeS: f("uptime"),
      time: n.time,
    };
  });
}

/** Every chart on the host page, keyed by the chart's dataKey. */
export interface ProxmoxNodeHistory {
  /** "CPU" percent. */
  cpu: ProxmoxMetricPoint[];
  /** Percent of all CPU time: "User", "System", "IO wait", "IRQ", "SoftIRQ", "Steal", "Guests". */
  cpuBreakdown: ProxmoxMetricPoint[];
  /** "1 min", "5 min", "15 min". */
  load: ProxmoxMetricPoint[];
  /** Bytes: "Used", "Available", "Shared", "ZFS ARC", "Total". */
  memory: ProxmoxMetricPoint[];
  /** Bytes: "Used", "Total". */
  swap: ProxmoxMetricPoint[];
  /** "Root disk" percent used. */
  rootFs: ProxmoxMetricPoint[];
  /** Bytes/s per interface: "<nic> in" / "<nic> out". */
  nics: ProxmoxMetricPoint[];
  /** Percent used per storage: "<storage>". */
  storage: ProxmoxMetricPoint[];
}

export function emptyNodeHistory(): ProxmoxNodeHistory {
  return { cpu: [], cpuBreakdown: [], load: [], memory: [], swap: [], rootFs: [], nics: [], storage: [] };
}

const NODE_MEMORY_SERIES: Record<string, [keyof ProxmoxNodeHistory, string]> = {
  memused: ["memory", "Used"],
  memavailable: ["memory", "Available"],
  memshared: ["memory", "Shared"],
  arcsize: ["memory", "ZFS ARC"],
  memtotal: ["memory", "Total"],
  swapused: ["swap", "Used"],
  swaptotal: ["swap", "Total"],
};
const NODE_LOAD: Record<string, string> = { avg1: "1 min", avg5: "5 min", avg15: "15 min" };
// /proc/stat jiffies. PVE's total = user + nice + system + idle + iowait +
// irq + softirq + steal + guest + guest_nice (guest time is not inside user).
const CPU_BREAKDOWN: Record<string, string> = {
  user: "User",
  nice: "User",
  system: "System",
  iowait: "IO wait",
  irq: "IRQ",
  softirq: "SoftIRQ",
  steal: "Steal",
  guest: "Guests",
  guest_nice: "Guests",
};

/** Every series for one PVE node's page (and its storages), in one round trip. */
export async function queryProxmoxNodeHistory(host: string, range = "24h", window = "1h"): Promise<ProxmoxNodeHistory> {
  const name = assertProxmoxName(host, "host");
  const rows = await querySeries({
    range,
    window,
    base: `(r.object == "nodes" and r.host == "${name}") or (r.object == "storages" and r.nodename == "${name}")`,
    gauges: [
      pick("cpustat", ["cpu", ...Object.keys(NODE_LOAD)]),
      pick("memory", Object.keys(NODE_MEMORY_SERIES)),
      pick("blockstat", ["used", "blocks"]),
      `(r.object == "storages" and ${pick("system", ["used", "total"])})`,
    ],
    rates: [`(r.object == "nodes" and ${pick("nics", ["receive", "transmit"])})`],
    deltas: [pick("cpustat", ["total", ...Object.keys(CPU_BREAKDOWN)])],
  });

  const out = emptyNodeHistory();
  const cpuDeltas = new Map<string, Record<string, number>>();
  const rootAt = new Map<string, { used?: number; blocks?: number }>();
  const storageAt = new Map<string, { used?: number; total?: number }>();

  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const { measurement: m, field } = row;
    if (row.object === "storages") {
      const key = `${row.host}\u0000${row.time}`;
      const at = storageAt.get(key) ?? {};
      at[field as "used" | "total"] = row.value;
      storageAt.set(key, at);
    } else if (m === "cpustat") {
      if (field === "cpu") out.cpu.push(point(row, "CPU", row.value * 100));
      else if (NODE_LOAD[field]) out.load.push(point(row, NODE_LOAD[field]!));
      else {
        const at = cpuDeltas.get(row.time) ?? {};
        at[field] = row.value;
        cpuDeltas.set(row.time, at);
      }
    } else if (m === "memory") {
      const target = NODE_MEMORY_SERIES[field];
      if (target) out[target[0]].push(point(row, target[1]));
    } else if (m === "blockstat") {
      const at = rootAt.get(row.time) ?? {};
      at[field as "used" | "blocks"] = row.value;
      rootAt.set(row.time, at);
    } else if (m === "nics" && row.instance) {
      out.nics.push(point(row, `${row.instance} ${field === "receive" ? "in" : "out"}`));
    }
  }

  for (const [time, d] of cpuDeltas) {
    const total = d.total ?? 0;
    if (total <= 0) continue;
    const sums = new Map<string, number>();
    for (const [field, label] of Object.entries(CPU_BREAKDOWN)) {
      if (d[field] !== undefined) sums.set(label, (sums.get(label) ?? 0) + d[field]!);
    }
    for (const [label, value] of sums) out.cpuBreakdown.push({ time, nodeId: label, value: (value / total) * 100 });
  }
  for (const [time, v] of rootAt) {
    if (v.used !== undefined && v.blocks) out.rootFs.push({ time, nodeId: "Root disk", value: (v.used / v.blocks) * 100 });
  }
  for (const [key, v] of storageAt) {
    const [storage, time] = key.split("\u0000") as [string, string];
    if (v.used !== undefined && v.total) out.storage.push({ time, nodeId: storage, value: (v.used / v.total) * 100 });
  }
  return out;
}

// ============================================================================
// Storages
// ============================================================================

export interface ProxmoxStorage {
  /** proxmoxStorageKey(nodename, storage). */
  key: string;
  nodename: string;
  storage: string;
  /** dir, lvmthin, zfspool, pbs, nfs, … */
  type: string;
  total: number | null;
  used: number | null;
  avail: number | null;
  active: boolean;
  enabled: boolean;
  shared: boolean;
  /** Comma-separated content types (images, backup, iso, …). */
  content: string | null;
  time: string;
}

const STORAGE_NUMBERS = ["total", "used", "avail", "active", "enabled", "shared"] as const;

/** Latest state of every storage PVE reports, optionally one node's. */
export async function queryProxmoxStorages(nodename?: string): Promise<ProxmoxStorage[]> {
  const node = nodename ? ` and r.nodename == "${assertProxmoxName(nodename, "host")}"` : "";
  // The content field is a string: cast everything to string after last() so
  // the result has one _value type.
  const query = `
${fluxFrom("system", "-5m")}
  |> filter(fn: (r) => r.object == "storages"${node})
  |> filter(fn: (r) => r._measurement == "system" and ${fieldIn([...STORAGE_NUMBERS, "content"])})
  |> last()
  |> map(fn: (r) => ({ _time: r._time, _field: r._field, _value: string(v: r._value), host: r.host, nodename: r.nodename, type: r.type }))
  |> yield(name: "storages")`;
  const rows = await runFluxQuery(query, (row) => row);
  const byKey = new Map<string, { nodename: string; storage: string; type: string; time: string; values: Record<string, string> }>();
  for (const row of rows) {
    const nodenameTag = row.nodename ?? "";
    const storage = row.host ?? "";
    const key = proxmoxStorageKey(nodenameTag, storage);
    let entry = byKey.get(key);
    if (!entry) byKey.set(key, (entry = { nodename: nodenameTag, storage, type: row.type ?? "", time: "", values: {} }));
    entry.values[row._field ?? ""] = row._value ?? "";
    if ((row._time ?? "") > entry.time) entry.time = row._time ?? "";
  }
  return [...byKey.entries()]
    .map(([key, s]) => ({
      key,
      nodename: s.nodename,
      storage: s.storage,
      type: s.type,
      total: num(s.values.total),
      used: num(s.values.used),
      avail: num(s.values.avail),
      active: num(s.values.active) === 1,
      enabled: num(s.values.enabled) === 1,
      shared: num(s.values.shared) === 1,
      content: s.values.content || null,
      time: s.time,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}
