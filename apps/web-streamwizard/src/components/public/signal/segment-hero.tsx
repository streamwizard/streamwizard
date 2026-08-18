import type { LucideIcon } from "lucide-react";

/*
 * Cluster-page hero: a zoomed segment of the signal path. The line enters from
 * the left viewport edge, runs through this page's enlarged node, and exits
 * right, so every cluster page reads as one station of the same pipeline the
 * homepage draws whole.
 */
export function SegmentHero({
  icon: Icon,
  tone,
  station,
  title,
  lede,
  stat,
  children,
}: {
  icon: LucideIcon;
  tone: string;
  /** Real product designation shown on the node, e.g. "SRT / SRTLA ingest". */
  station: string;
  title: string;
  lede: string;
  /** Optional ticking element riding the far end of the passing line. */
  stat?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden pt-20 pb-16 md:pt-28 md:pb-20">
      {/* The passing line, full-bleed behind the node */}
      <div className="absolute inset-x-0 top-[7.25rem] h-px md:top-[9.25rem] signal-grad-x opacity-40" aria-hidden="true" />
      <div className="absolute inset-x-0 top-[7.25rem] h-0.5 md:top-[9.25rem] signal-grad-x signal-dash-x" aria-hidden="true" />

      <div className="container relative z-10 mx-auto px-4">
        {/* The node and its nameplate sit together on the passing line: a
            station label in the diagram, not a heading eyebrow. */}
        <div className="flex items-center gap-4">
          <div className={`grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-border bg-card md:h-20 md:w-20 ${tone}`} aria-hidden="true">
            <Icon className="h-8 w-8 md:h-9 md:w-9" />
          </div>
          <p className="rounded-md border border-border bg-background/80 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-muted-foreground">
            {station}
          </p>
          {stat ? <div className="ml-auto hidden md:block">{stat}</div> : null}
        </div>
        <h1 className="mt-8 max-w-3xl text-3xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl">{title}</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted-foreground md:text-xl">{lede}</p>
        {children ? <div className="mt-8 flex flex-wrap items-center gap-4">{children}</div> : null}
      </div>
    </section>
  );
}
