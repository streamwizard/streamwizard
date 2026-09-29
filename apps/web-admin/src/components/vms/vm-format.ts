import type { IndicatorStatus } from "@/components/widgets/status-indicator";

/** PVE's guest status → dot + label. A stopped VM is often on purpose, so it
 * stays grey; the vm.down alert is where "should be running" lives. */
export function vmStatusDisplay(status: string): { indicator: IndicatorStatus; label: string } {
  switch (status) {
    case "running":
      return { indicator: "ok", label: "Running" };
    case "stopped":
      return { indicator: "muted", label: "Stopped" };
    case "paused":
    case "suspended":
    case "prelaunch":
      return { indicator: "warn", label: status[0]!.toUpperCase() + status.slice(1) };
    default:
      return { indicator: "crit", label: status || "Unknown" };
  }
}

/** A host is online while it keeps pushing metrics to Influx. */
export function hostStatusDisplay(stale: boolean): { indicator: IndicatorStatus; label: string } {
  return stale ? { indicator: "crit", label: "Not reporting" } : { indicator: "ok", label: "Online" };
}

export const AGENT_LABEL: Record<string, string> = {
  ok: "Agent OK",
  off: "No agent",
  error: "Agent not answering",
};

/** "12 min", "5 h 20 min", "3 d 4 h". */
export function formatUptime(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} h ${m % 60} min`;
  return `${Math.floor(h / 24)} d ${h % 24} h`;
}

export function formatPct(value: number | null | undefined): string {
  return value == null || !Number.isFinite(value) ? "—" : `${value.toFixed(0)}%`;
}

export const vmHref = (host: string, vmid: number) => `/vms/${encodeURIComponent(host)}/${vmid}`;

export const vmHostHref = (host: string) => `/vms/hosts/${encodeURIComponent(host)}`;

/** Hover text for PVE's guest RAM figure. */
export const RAM_CACHE_HINT =
  "What Proxmox reports: total minus free inside the guest, so page cache counts as used. top or htop in the VM will show less.";

/** Hover text for memhost. */
export const HELD_ON_HOST_HINT = "RAM the VM's QEMU process holds on the host. Often the full assigned RAM.";

/** Warn/danger colouring for a usage percentage. */
export function usageTone(pct: number | null | undefined, warn = 85, crit = 95): "default" | "warning" | "danger" {
  if (pct == null) return "default";
  return pct >= crit ? "danger" : pct >= warn ? "warning" : "default";
}

export function pctOf(used: number | null | undefined, total: number | null | undefined): number | null {
  return used == null || !total ? null : (used / total) * 100;
}

export function formatLoad(value: number | null | undefined): string {
  return value == null ? "—" : value.toFixed(2);
}
