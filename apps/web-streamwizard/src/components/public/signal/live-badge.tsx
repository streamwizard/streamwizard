/*
 * The one red moment on any public page. Red exists nowhere else on the
 * marketing surface, so the payoff of the signal path (the stream going live)
 * is the only thing that gets to use it. Never render twice on one page.
 */
export function LiveBadge({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-xs font-semibold uppercase tracking-widest text-destructive ${className}`}>
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
      </span>
      Live
    </span>
  );
}
