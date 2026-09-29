/** Tiny trend line, no axes. `max` pins the top (e.g. 100 for percent);
 * otherwise the series' own peak is the top. */
export function Sparkline({
  values,
  max,
  label,
  color = "var(--chart-1)",
}: {
  values: number[];
  max?: number;
  label: string;
  color?: string;
}) {
  const W = 64;
  const H = 18;
  if (values.length < 2) return <span className="inline-block h-[18px] w-16" aria-hidden="true" />;
  const top = Math.max(max ?? 0, ...values) || 1;
  const step = W / (values.length - 1);
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(H - 1 - (Math.max(0, v) / top) * (H - 2)).toFixed(1)}`).join(" ");
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ color }} role="img" aria-label={label}>
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
