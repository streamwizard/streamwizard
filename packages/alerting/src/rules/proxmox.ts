import {
  queryLatestProxmoxGuests,
  queryLatestProxmoxNodes,
  queryProxmoxStorages,
  type ProxmoxGuestLatest,
  type ProxmoxNodeLatest,
  type ProxmoxStorage,
} from "@repo/metrics";
import type { AlertRule, Breach, EnvContext, RuleOverrides } from "../types";
import { customRule, pct, perTick, thresholdRule, type ThresholdSample } from "./builders";
import {
  VM_CPU_CRIT_PCT,
  VM_CPU_WARN_PCT,
  VM_HOST_CPU_CRIT_PCT,
  VM_HOST_CPU_WARN_PCT,
  VM_HOST_MEM_CRIT_PCT,
  VM_HOST_MEM_WARN_PCT,
  VM_IO_PRESSURE_CRIT_PCT,
  VM_IO_PRESSURE_WARN_PCT,
  VM_MEM_CRIT_PCT,
  VM_MEM_WARN_PCT,
  VM_STALE_SECONDS,
  VM_STORAGE_CRIT_PCT,
  VM_STORAGE_WARN_PCT,
} from "./thresholds";

/**
 * Proxmox VM rules (docs/proxmox-monitoring-plan.md). Everything comes from
 * the metrics Proxmox VE pushes to Influx every ~10 s: guest status, tags,
 * CPU and RAM, node load and storages. Stopped guests keep pushing, so a
 * guest or node that goes quiet for VM_STALE_SECONDS is gone or cut off.
 * vm.down and vm.host_unreachable fire on the first tick that sees it, so an
 * alert goes out within about a minute (one worker tick plus one push).
 *
 * VM rules are opt-in: they only emit for guests tagged `streamwizard` in
 * Proxmox whose proxmox_vm_alert_settings.rules contains the rule id (from the
 * tick snapshot). Host and storage rules are always on. Entity ids:
 * "<node>:<vmid>" for VMs, the node name for hosts, "<node>:<storage>" for
 * storages. PVE node names equal the PVE_HOSTS names. Only prod has PVE data,
 * hence envs ["prod"].
 */

/** The Proxmox tag that marks a guest as one of ours. Only tagged VMs get
 * per-VM alerts; web-admin lists the rest under "Other VMs". */
export const STREAMWIZARD_VM_TAG = "streamwizard";

export function isStreamwizardVm(tags: readonly string[] | null | undefined): boolean {
  return tags?.includes(STREAMWIZARD_VM_TAG) ?? false;
}

/** The per-VM, opt-in rules: what web-admin shows as switches on a VM page
 * and what proxmox_vm_alert_settings.rules may hold. Host rules are not here,
 * they are always on. */
export const VM_ALERT_RULES = [
  { id: "vm.down", title: "VM down", description: "Stopped, paused or no longer reported by Proxmox." },
  { id: "vm.cpu_high", title: "VM CPU high", description: "CPU stays above the threshold." },
  { id: "vm.mem_high", title: "VM RAM high", description: "RAM stays above the threshold. Counts the guest's cache as used." },
  { id: "vm.io_pressure_high", title: "VM IO pressure high", description: "Tasks keep waiting on disk IO." },
] as const;

export type VmAlertRuleId = (typeof VM_ALERT_RULES)[number]["id"];

export const VM_ALERT_RULE_IDS: readonly VmAlertRuleId[] = VM_ALERT_RULES.map((r) => r.id);

export function isVmAlertRuleId(id: string): id is VmAlertRuleId {
  return (VM_ALERT_RULE_IDS as readonly string[]).includes(id);
}

const STALE_MS = VM_STALE_SECONDS * 1000;

const guestEntityId = (g: Pick<ProxmoxGuestLatest, "nodename" | "vmid">) => `${g.nodename}:${g.vmid}`;
const guestLabel = (g: ProxmoxGuestLatest) => `${g.name || `VM ${g.vmid}`} (${g.nodename}/${g.vmid})`;
const ageMs = (ctx: EnvContext, iso: string) => (iso ? ctx.now.getTime() - Date.parse(iso) : Infinity);
const isStale = (ctx: EnvContext, iso: string) => ageMs(ctx, iso) > STALE_MS;
/** "95 s" under two minutes, "12 min" after. */
const silentFor = (ms: number) => (ms < 120_000 ? `${Math.round(ms / 1000)} s` : `${Math.round(ms / 60_000)} min`);

// --- One Influx read per kind per tick ---

// An hour back, so a guest or node that went quiet is still listed (as gone)
// for a while instead of silently dropping out.
const guests = perTick(() => queryLatestProxmoxGuests("1h"));
const nodes = perTick(() => queryLatestProxmoxNodes("1h"));
const storages = perTick(() => queryProxmoxStorages());

/** Nodes that stopped pushing: vm.host_unreachable fires for them, so the
 * other rules skip their guests and storages instead of doubling up. */
async function downNodes(ctx: EnvContext): Promise<Set<string>> {
  return new Set((await nodes(ctx)).filter((n) => isStale(ctx, n.time)).map((n) => n.host));
}

// Messages and notifications only get the entity id; evaluation records each
// guest's name so both can show it instead of "pve1:100".
const labels = new Map<string, { name: string; host: string; label: string }>();

/** Name and node of a guest a vm.* rule evaluated, for notifications. */
export function proxmoxGuestName(entityId: string): { name: string; host: string } | undefined {
  const entry = labels.get(entityId);
  return entry && { name: entry.name, host: entry.host };
}

const labelOf = (entityId: string) => labels.get(entityId)?.label ?? entityId;

/** Guests tagged `streamwizard` with this rule switched on, recording labels. */
async function optedIn(ctx: EnvContext, ruleId: string): Promise<ProxmoxGuestLatest[]> {
  const rulesByGuest = new Map(ctx.registry.proxmoxVmAlertSettings.map((s) => [`${s.host}:${s.vmid}`, s.rules]));
  const picked = (await guests(ctx)).filter(
    (g) => isStreamwizardVm(g.tags) && (rulesByGuest.get(guestEntityId(g)) ?? []).includes(ruleId),
  );
  for (const g of picked) labels.set(guestEntityId(g), { name: g.name || `VM ${g.vmid}`, host: g.nodename, label: guestLabel(g) });
  return picked;
}

/** Samples for a VM threshold rule: opted-in guests that are running and
 * still pushing, on a node that is up. */
async function vmSamples(ctx: EnvContext, ruleId: string, pick: (g: ProxmoxGuestLatest) => number | undefined): Promise<ThresholdSample[]> {
  const down = await downNodes(ctx);
  const samples: ThresholdSample[] = [];
  for (const g of await optedIn(ctx, ruleId)) {
    if (down.has(g.nodename) || isStale(ctx, g.time) || g.status !== "running") continue;
    const value = pick(g);
    if (value === undefined || Number.isNaN(value)) continue;
    samples.push({ entityId: guestEntityId(g), value });
  }
  return samples;
}

/** Host samples, skipping nodes vm.host_unreachable already covers. */
async function hostSamples(ctx: EnvContext, pick: (fields: Record<string, number>) => number | undefined): Promise<ThresholdSample[]> {
  const samples: ThresholdSample[] = [];
  for (const node of await nodes(ctx)) {
    if (isStale(ctx, node.time)) continue;
    const value = pick(node.fields);
    if (value === undefined || Number.isNaN(value)) continue;
    samples.push({ entityId: node.host, value });
  }
  return samples;
}

/**
 * Storages worth alerting on: active and enabled, not PBS (backup.datastore_usage
 * watches those datastores directly), and a shared storage only once (every
 * node reports the same numbers for it).
 */
export function storagesToWatch(rows: ProxmoxStorage[]): ProxmoxStorage[] {
  const seenShared = new Set<string>();
  return rows
    .filter((s) => s.active && s.enabled && s.type !== "pbs" && s.total !== null && s.total > 0 && s.used !== null)
    .sort((a, b) => a.key.localeCompare(b.key))
    .filter((s) => {
      if (!s.shared) return true;
      if (seenShared.has(s.storage)) return false;
      seenShared.add(s.storage);
      return true;
    });
}

export function proxmoxRules(overrides: RuleOverrides): AlertRule[] {
  return [
    customRule(
      {
        id: "vm.down",
        title: "VM down",
        forTicks: 1,
        envs: ["prod"],
        async evaluate(ctx) {
          const down = await downNodes(ctx);
          const breaches: Breach[] = [];
          for (const g of await optedIn(ctx, "vm.down")) {
            if (down.has(g.nodename)) continue;
            const silentMs = ageMs(ctx, g.time);
            if (silentMs > STALE_MS) {
              breaches.push({
                entityId: guestEntityId(g),
                severity: "crit",
                value: Math.round(silentMs / 1000),
                message: `${guestLabel(g)} not reported by Proxmox for ${silentFor(silentMs)}`,
              });
            } else if (g.status !== "running") {
              breaches.push({ entityId: guestEntityId(g), severity: "crit", message: `${guestLabel(g)} is ${g.status || "not running"}` });
            }
          }
          return breaches;
        },
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.cpu_high",
        title: "VM CPU high",
        forTicks: 3,
        envs: ["prod"],
        warn: VM_CPU_WARN_PCT,
        crit: VM_CPU_CRIT_PCT,
        unit: "%",
        // PVE reports cpu as a 0-1 fraction of the guest's cores.
        fetch: (ctx) => vmSamples(ctx, "vm.cpu_high", (g) => (g.fields.cpu === undefined ? undefined : g.fields.cpu * 100)),
        format: (id, v, t) => `CPU on ${labelOf(id)} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.mem_high",
        title: "VM RAM high",
        forTicks: 3,
        envs: ["prod"],
        warn: VM_MEM_WARN_PCT,
        crit: VM_MEM_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => vmSamples(ctx, "vm.mem_high", (g) => pct(g.fields.mem, g.fields.maxmem)),
        format: (id, v, t) => `RAM on ${labelOf(id)} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.io_pressure_high",
        title: "VM IO pressure high",
        forTicks: 3,
        envs: ["prod"],
        warn: VM_IO_PRESSURE_WARN_PCT,
        crit: VM_IO_PRESSURE_CRIT_PCT,
        unit: "%",
        // PSI io "some" as PVE reports it: percent of time at least one task
        // in the guest was stalled on IO.
        fetch: (ctx) => vmSamples(ctx, "vm.io_pressure_high", (g) => g.fields.pressureiosome),
        format: (id, v, t) => `IO pressure on ${labelOf(id)} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.host_cpu_high",
        title: "Proxmox host CPU high",
        forTicks: 4,
        envs: ["prod"],
        warn: VM_HOST_CPU_WARN_PCT,
        crit: VM_HOST_CPU_CRIT_PCT,
        unit: "%",
        fetch: (ctx) => hostSamples(ctx, (f) => (f.cpu === undefined ? undefined : f.cpu * 100)),
        format: (id, v, t) => `CPU on Proxmox host ${id} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.host_mem_high",
        title: "Proxmox host RAM high",
        forTicks: 3,
        envs: ["prod"],
        warn: VM_HOST_MEM_WARN_PCT,
        crit: VM_HOST_MEM_CRIT_PCT,
        unit: "%",
        // PVE's memused is total − available, so page cache doesn't count.
        fetch: (ctx) => hostSamples(ctx, (f) => pct(f.memused, f.memtotal)),
        format: (id, v, t) => `RAM on Proxmox host ${id} at ${v.toFixed(0)}% (warn > ${t.warn}%)`,
      },
      overrides,
    ),
    thresholdRule(
      {
        id: "vm.storage_high",
        title: "Proxmox storage filling up",
        forTicks: 2,
        envs: ["prod"],
        warn: VM_STORAGE_WARN_PCT,
        crit: VM_STORAGE_CRIT_PCT,
        unit: "%",
        fetch: async (ctx) => {
          const down = await downNodes(ctx);
          return storagesToWatch(await storages(ctx))
            .filter((s) => !down.has(s.nodename))
            .flatMap((s) => {
              const value = pct(s.used ?? undefined, s.total ?? undefined);
              return value === undefined ? [] : [{ entityId: s.key, value }];
            });
        },
        format: (id, v, t) => {
          const [host, storage] = id.split(":");
          return `Storage ${storage} on ${host} at ${v.toFixed(0)}% (warn > ${t.warn}%)`;
        },
      },
      overrides,
    ),
    customRule(
      {
        id: "vm.host_unreachable",
        title: "Proxmox host unreachable",
        forTicks: 1,
        envs: ["prod"],
        // Hosts are the nodes that pushed in the last hour; one that went quiet
        // longer than that drops out of the read and resolves. A host whose
        // pushes go through a guest (pve1 behind pfSense) also goes quiet
        // while that guest restarts.
        async evaluate(ctx) {
          return (await nodes(ctx)).flatMap((node) => {
            if (!isStale(ctx, node.time)) return [];
            const silentMs = ageMs(ctx, node.time);
            return [
              {
                entityId: node.host,
                severity: "crit" as const,
                value: Math.round(silentMs / 1000),
                message: `Proxmox host ${node.host} hasn't reported for ${silentFor(silentMs)}`,
              },
            ];
          });
        },
      },
      overrides,
    ),
  ];
}
