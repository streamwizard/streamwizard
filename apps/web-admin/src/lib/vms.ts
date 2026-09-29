import {
  emptyGuestHistory,
  emptyNodeHistory,
  proxmoxGuestKey,
  queryLatestProxmoxGuests,
  queryLatestProxmoxNodes,
  queryProxmoxGuestHistory,
  queryProxmoxGuestSnapshot,
  queryProxmoxGuestSparklines,
  queryProxmoxNodeHistory,
  queryProxmoxNodeSnapshot,
  queryProxmoxStorages,
  type ProxmoxGuestHistory,
  type ProxmoxGuestLatest,
  type ProxmoxGuestSnapshot,
  type ProxmoxGuestSparkline,
  type ProxmoxNodeHistory,
  type ProxmoxNodeSnapshot,
  type ProxmoxStorage,
} from "@repo/metrics";
import { isStreamwizardVm, isVmAlertRuleId } from "@repo/alerting/rules";
import { supabaseAdmin } from "@repo/supabase/next/admin";
import { getVmAlertSettings } from "@repo/supabase/queries/proxmox";
import type { GuestRef } from "@/lib/pve";

/**
 * Server-side reads for /vms. Everything comes from the metrics Proxmox VE
 * pushes to Influx every ~10 s, stopped guests included: the guest list,
 * status, tags, uptime and live numbers. Only the per-VM alert opt-ins live in
 * Supabase. IPs, agent state and disk use come from the PVE API on demand
 * (lib/pve.ts) and stream in after the table.
 *
 * PVE node names equal the PVE_HOSTS names, so a guest is `${node}:${vmid}`.
 */

export const METRICS_DOWN = "InfluxDB didn't answer, so there is nothing to show.";

/** Data older than this is marked stale on the page (PVE pushes every ~10 s);
 * the same 90 s after which the alerts count a guest or host as gone. */
export const STALE_AFTER_MS = 90_000;

/** The list reaches back this far, so a guest that stopped reporting still
 * shows (as stale) instead of vanishing. */
const LIST_RANGE = "24h";

const isStale = (iso: string, now: number) => !iso || now - Date.parse(iso) > STALE_AFTER_MS;

export interface VmView {
  guest: ProxmoxGuestLatest;
  metrics: ProxmoxGuestSnapshot | null;
  spark: ProxmoxGuestSparkline | null;
  /** vm.* rule ids switched on for this VM. */
  alertRules: string[];
  /** No push from Proxmox for a while: status and numbers may be old. */
  stale: boolean;
}

/** One PVE host: when it last pushed, its live numbers and storages. */
export interface HostView {
  name: string;
  lastSeen: string;
  stale: boolean;
  metrics: ProxmoxNodeSnapshot | null;
  storages: ProxmoxStorage[];
  /** Sum of memhost over the host's running guests. */
  vmHeldBytes: number | null;
}

export interface VmOverview {
  hosts: HostView[];
  vms: VmView[];
}

async function soft<T>(label: string, run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run();
  } catch (error) {
    console.error(`[vms ${label}]`, error);
    return fallback;
  }
}

const isRunning = (v: VmView) => v.guest.status === "running" && !v.stale;

/** Sum of the RAM each running guest holds on its host. */
function heldByGuests(host: string, vms: VmView[]): number | null {
  const held = vms.filter((v) => v.guest.nodename === host && isRunning(v) && v.metrics?.memHost != null);
  return held.length === 0 ? null : held.reduce((sum, v) => sum + (v.metrics!.memHost ?? 0), 0);
}

/** VMs tagged `streamwizard` in Proxmox first, then the rest ("Other VMs"). */
export function splitVms(vms: VmView[]): { ours: VmView[]; others: VmView[] } {
  return {
    ours: vms.filter((v) => isStreamwizardVm(v.guest.tags)),
    others: vms.filter((v) => !isStreamwizardVm(v.guest.tags)),
  };
}

async function alertRulesByVm(): Promise<Map<string, string[]>> {
  const settings = await getVmAlertSettings(supabaseAdmin);
  return new Map(settings.map((s) => [proxmoxGuestKey(s.host, s.vmid), s.rules.filter(isVmAlertRuleId)]));
}

/**
 * Everything /vms (or one host's page, with `host`) shows. Throws when the
 * guest list can't be read: without it there is nothing to show. The live
 * numbers, sparklines, storages and alert opt-ins are optional.
 */
export async function getVmOverview(host?: string): Promise<VmOverview> {
  const [latest, nodes, rules, snapshot, sparks, nodeSnapshot, storages] = await Promise.all([
    queryLatestProxmoxGuests(LIST_RANGE).catch((error) => {
      console.error("[vms list]", error);
      throw new Error(METRICS_DOWN);
    }),
    soft("nodes", () => queryLatestProxmoxNodes(LIST_RANGE), []),
    soft("alert settings", alertRulesByVm, new Map<string, string[]>()),
    soft("snapshot", () => queryProxmoxGuestSnapshot(host), [] as ProxmoxGuestSnapshot[]),
    soft("sparklines", () => queryProxmoxGuestSparklines("1h", "5m", host), [] as ProxmoxGuestSparkline[]),
    soft("node snapshot", () => queryProxmoxNodeSnapshot(host), [] as ProxmoxNodeSnapshot[]),
    soft("storages", () => queryProxmoxStorages(host), [] as ProxmoxStorage[]),
  ]);
  const now = Date.now();
  const byKey = new Map(snapshot.map((g) => [g.key, g]));
  const sparkByKey = new Map(sparks.map((s) => [s.key, s]));

  const vms = latest
    .filter((g) => !host || g.nodename === host)
    .sort((a, b) => a.nodename.localeCompare(b.nodename) || a.vmid - b.vmid)
    .map((guest): VmView => {
      const key = proxmoxGuestKey(guest.nodename, guest.vmid);
      return {
        guest,
        metrics: byKey.get(key) ?? null,
        spark: sparkByKey.get(key) ?? null,
        alertRules: rules.get(key) ?? [],
        stale: isStale(guest.time, now),
      };
    });

  return {
    hosts: nodes
      .filter((n) => !host || n.host === host)
      .sort((a, b) => a.host.localeCompare(b.host))
      .map((n) => ({
        name: n.host,
        lastSeen: n.time,
        stale: isStale(n.time, now),
        metrics: nodeSnapshot.find((s) => s.host === n.host) ?? null,
        storages: storages.filter((s) => s.nodename === n.host),
        vmHeldBytes: heldByGuests(n.host, vms),
      })),
    vms,
  };
}

/** One guest for its detail page; null when Proxmox never reported it. */
export async function getVm(host: string, vmid: number): Promise<VmView | null> {
  const { vms } = await getVmOverview(host);
  return vms.find((v) => v.guest.vmid === vmid) ?? null;
}

/** Chart series for one guest. Never throws: an Influx failure is empty charts. */
export async function fetchGuestSeries(host: string, vmid: number, range = "24h", window = "1h"): Promise<ProxmoxGuestHistory> {
  return soft("guest history", () => queryProxmoxGuestHistory(host, vmid, range, window), emptyGuestHistory());
}

/** Chart series for one PVE host and its storages. Never throws. */
export async function fetchHostSeries(host: string, range = "24h", window = "1h"): Promise<ProxmoxNodeHistory> {
  return soft("host history", () => queryProxmoxNodeHistory(host, range, window), emptyNodeHistory());
}

/** What lib/pve.ts needs to look a guest up on its host. */
export const guestRef = (v: VmView): GuestRef => ({
  host: v.guest.nodename,
  vmid: v.guest.vmid,
  type: v.guest.type,
  running: isRunning(v),
});

/** Plain, serializable row for the client-side VM table. */
export interface VmTableRow {
  key: string;
  host: string;
  vmid: number;
  name: string;
  type: string;
  status: string;
  running: boolean;
  stale: boolean;
  lastSeen: string;
  uptimeS: number | null;
  alertRules: string[];
  cpuPct: number | null;
  cpus: number | null;
  memUsed: number | null;
  memMax: number | null;
  memHost: number | null;
  /** PVE's own disk numbers, real for containers only. Qemu disk use comes
   * from the guest agent with the IPs. */
  lxcDiskUsed: number | null;
  lxcDiskTotal: number | null;
  netInBps: number | null;
  netOutBps: number | null;
  cpuSpark: number[];
  netSpark: number[];
}

export function toTableRow(v: VmView): VmTableRow {
  const { guest, metrics, spark, alertRules, stale } = v;
  const running = isRunning(v);
  const live = running ? metrics : null;
  const lxcDisk = guest.type === "lxc" && metrics?.diskUsed != null && metrics.diskMax ? metrics : null;
  return {
    key: proxmoxGuestKey(guest.nodename, guest.vmid),
    host: guest.nodename,
    vmid: guest.vmid,
    name: guest.name || `VM ${guest.vmid}`,
    type: guest.type,
    status: guest.status || "unknown",
    running,
    stale,
    lastSeen: guest.time,
    uptimeS: running ? (metrics?.uptimeS ?? guest.fields.uptime ?? null) : null,
    alertRules,
    cpuPct: live?.cpuPct ?? null,
    cpus: metrics?.cpus ?? null,
    memUsed: live?.memUsed ?? null,
    memMax: metrics?.memMax ?? guest.fields.maxmem ?? null,
    memHost: live?.memHost ?? null,
    lxcDiskUsed: lxcDisk?.diskUsed ?? null,
    lxcDiskTotal: lxcDisk?.diskMax ?? null,
    netInBps: live?.netInBps ?? null,
    netOutBps: live?.netOutBps ?? null,
    cpuSpark: running ? (spark?.cpu ?? []) : [],
    netSpark: running ? (spark?.net ?? []) : [],
  };
}
