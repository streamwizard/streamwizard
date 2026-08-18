import { DemoDataTag } from "@/components/public/signal/stats";

/*
 * Quiet section: analytics has no dedicated marketing page (approved sitemap),
 * so it earns one calm moment on the spine. The chart is a static authored
 * illustration with deterministic values, labeled demo data.
 */
const HOURLY_VIEWERS = [42, 58, 51, 74, 96, 132, 121, 148, 165, 143, 108, 87];

export function AnalyticsSection() {
  const max = Math.max(...HOURLY_VIEWERS);
  return (
    <div className="grid items-center gap-8 md:grid-cols-2 md:gap-16">
      <p className="max-w-xl text-base text-muted-foreground">
        Hourly viewer curves, category stats and recent streams, right on your dashboard. Know which game carried the
        night without exporting a single CSV.
      </p>
      <figure className="max-w-md">
        <div className="flex h-24 items-end gap-1.5" aria-hidden="true">
          {HOURLY_VIEWERS.map((value, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm bg-[#3b82f6]/70"
              style={{ height: `${Math.round((value / max) * 100)}%` }}
            />
          ))}
        </div>
        <figcaption className="mt-2 flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          <span>viewers by hour</span>
          <DemoDataTag />
        </figcaption>
      </figure>
    </div>
  );
}
