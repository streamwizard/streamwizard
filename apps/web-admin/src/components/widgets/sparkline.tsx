import { cn } from "@/lib/utils";

/**
 * A plain SVG polyline, cheap enough to draw 20+ times on one page where a
 * Recharts chart each would not be. null values break the line, so a gap in
 * the data shows as a gap instead of a dip to zero.
 */
export function Sparkline({
  values,
  width = 120,
  height = 28,
  className,
  label,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  className?: string;
  /** Screen-reader summary, e.g. "notifications, last 6 hours". */
  label: string;
}) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pad = 2;
  const y = (v: number) => pad + (height - pad * 2) * (1 - v / max);

  // Split into runs of non-null points; each run is its own polyline.
  const runs: string[] = [];
  let current: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (current.length) runs.push(current.join(" "));
      current = [];
      return;
    }
    current.push(`${(i * step).toFixed(1)},${y(v).toFixed(1)}`);
  });
  if (current.length) runs.push(current.join(" "));

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
      className={cn("overflow-visible text-[var(--chart-1)]", className)}
    >
      <line x1={0} x2={width} y1={height - pad} y2={height - pad} className="stroke-border" strokeWidth={1} />
      {runs.map((points, i) =>
        points.includes(" ") ? (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ) : (
          // A lone point between two gaps: draw a dot so it isn't invisible.
          <circle key={i} cx={points.split(",")[0]} cy={points.split(",")[1]} r={1.5} fill="currentColor" />
        ),
      )}
    </svg>
  );
}
