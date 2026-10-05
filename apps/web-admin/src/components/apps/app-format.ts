import type { IndicatorStatus } from "@/components/widgets/status-indicator";
import type { AppEnv, AppHealth, AppRow } from "@/lib/apps-model";

export const appHref = (env: AppEnv, app: string) => `/apps/${env}/${encodeURIComponent(app)}`;

export const SERVER_HREF = "/apps/server";

/** Health → dot + label. A stopped app we expect is red; one we merely see is grey. */
export function healthDisplay(row: Pick<AppRow, "health" | "expected">): { indicator: IndicatorStatus; label: string } {
  const labels: Record<AppHealth, { indicator: IndicatorStatus; label: string }> = {
    healthy: { indicator: "ok", label: "Healthy" },
    running: { indicator: "ok", label: "Running" },
    starting: { indicator: "warn", label: "Starting" },
    unhealthy: { indicator: "crit", label: "Unhealthy" },
    stopped: { indicator: row.expected ? "crit" : "muted", label: "Not running" },
    nodata: { indicator: "muted", label: "No data" },
  };
  return labels[row.health];
}

export const CPU_HINT = "Percent of one core: 100% is one core kept busy, 250% is two and a half.";
export const MEMORY_HINT = "Memory in use without the file cache the kernel can drop. Same number as docker stats.";
export const STARTS_HINT = "New containers in the last 24 hours. A deploy counts as one. Failed means it stopped with an exit code other than 0 or 143, or the kernel killed it for memory.";
export const REQUESTS_HINT = "From Traefik, over the last 5 minutes. Apps without a route show nothing.";
export const ERRORS_HINT = "Share of answers with a 5xx status in the last 5 minutes.";
export const RESPONSE_HINT = "Mean time Traefik waited for the app in the last 5 minutes. Long-lived connections (WebSocket, streams) count with their full length.";

/** CPU can pass 100% (several cores), so no clamping. */
export function formatCpu(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${value < 10 ? value.toFixed(1) : value.toFixed(0)}%`;
}

export function formatPerSec(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0/s";
  return value < 0.1 ? "<0.1/s" : `${value < 10 ? value.toFixed(1) : value.toFixed(0)}/s`;
}

export function formatErrorPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "0%";
  return value < 0.1 ? "<0.1%" : `${value < 10 ? value.toFixed(1) : value.toFixed(0)}%`;
}

export function formatMs(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 10_000) return `${(value / 1000).toFixed(0)} s`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)} s`;
  return `${value < 10 ? value.toFixed(1) : value.toFixed(0)} ms`;
}

/** Colour for the error share: any 5xx is worth a look, a steady stream is bad. */
export function errorTone(pct: number | null | undefined): "default" | "warning" | "danger" {
  if (pct == null || pct < 1) return "default";
  return pct >= 5 ? "danger" : "warning";
}
