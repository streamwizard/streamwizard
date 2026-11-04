import { cn } from "@/lib/utils";

const BAR_TONE = {
  default: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
} as const;

/** Thin usage bar: green, amber from `warn`, red from `crit`. */
export function UsageMeter({
  pct,
  label,
  warn = 85,
  crit = 95,
  className,
}: {
  pct: number | null;
  label: string;
  warn?: number;
  crit?: number;
  className?: string;
}) {
  const value = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const tone = pct == null ? "default" : pct >= crit ? "danger" : pct >= warn ? "warning" : "default";
  return (
    <div
      className={cn("h-1.5 overflow-hidden rounded-full bg-muted", className)}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      aria-label={label}
    >
      {pct != null && <div className={cn("h-full", BAR_TONE[tone])} style={{ width: `${value}%` }} />}
    </div>
  );
}
