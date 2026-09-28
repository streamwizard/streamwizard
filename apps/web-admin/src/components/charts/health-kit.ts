import type { IndicatorStatus } from "@/components/widgets/status-indicator";

// Shared by the health banners (/supabase, /eventsub): a value is banded
// against warn/crit limits, and the worst check decides the banner.

export type Band = { warn: number; crit: number; direction: "above" | "below" };

export function band(value: number | null, b: Band): IndicatorStatus {
  if (value === null) return "muted";
  const over = (limit: number) => (b.direction === "above" ? value > limit : value < limit);
  if (over(b.crit)) return "crit";
  if (over(b.warn)) return "warn";
  return "ok";
}

export const SEVERITY: Record<IndicatorStatus, number> = { muted: 0, ok: 1, warn: 2, crit: 3 };

export function worstStatus(statuses: IndicatorStatus[]): IndicatorStatus {
  return statuses.reduce<IndicatorStatus>((acc, s) => (SEVERITY[s] > SEVERITY[acc] ? s : acc), "muted");
}

export const TILE_TONE = { ok: "default", muted: "default", warn: "warning", crit: "danger" } as const;

export const BANNER_BORDER: Record<IndicatorStatus, string> = {
  ok: "border-emerald-500/40",
  warn: "border-amber-500/50",
  crit: "border-red-500/60",
  muted: "",
};
