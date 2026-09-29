import type { BackupStatus } from "@repo/backups";
import type { IndicatorStatus } from "@/components/widgets/status-indicator";

export { formatBytes } from "@/lib/format";

export const STATUS_DISPLAY: Record<BackupStatus, { indicator: IndicatorStatus; label: string; tone: "positive" | "warning" | "danger" | "default" }> = {
  ok: { indicator: "ok", label: "OK", tone: "positive" },
  warning: { indicator: "warn", label: "Warning", tone: "warning" },
  error: { indicator: "crit", label: "Error", tone: "danger" },
  unknown: { indicator: "muted", label: "Unknown", tone: "default" },
};

export const BANNER_BORDER: Record<BackupStatus, string> = {
  ok: "border-l-emerald-500",
  warning: "border-l-amber-500",
  error: "border-l-red-500",
  unknown: "border-l-muted-foreground/40",
};

/** "45 min", "9 h", "3 d" — a backup age or time since. */
export function formatAge(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const s = Math.max(0, seconds);
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 48 * 3600) return `${Math.floor(s / 3600)} h`;
  return `${Math.floor(s / 86400)} d`;
}

export function ageOf(iso: string | null | undefined): number | null {
  return iso ? (Date.now() - Date.parse(iso)) / 1000 : null;
}

export function relative(iso: string | null | undefined): string {
  const age = ageOf(iso);
  if (age === null) return "never";
  return age < 0 ? `in ${formatAge(-age)}` : `${formatAge(age)} ago`;
}

/** Absolute time in the viewer's locale, for tooltips and tables. */
export function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

export function epochToIso(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}
