import Link from "next/link";
import { ArrowRight, Bell, Clapperboard, Code2, Footprints, Gauge } from "lucide-react";
import { docsLink } from "@/lib/constant";

/*
 * The widget chips are the real seeded template catalog riding a short stretch
 * of the signal line — the overlay system dressed in the page's own grammar.
 */
const TEMPLATE_CHIPS = [
  { icon: Bell, name: "alert-box" },
  { icon: Footprints, name: "walking-stats" },
  { icon: Gauge, name: "auto-switcher-status" },
  { icon: Clapperboard, name: "clips-showcase" },
];

export function OverlaysSection() {
  return (
    <div>
      <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
        Build overlays in the browser, drop in widgets from the library, or code your own with the widget API. OBS
        gets one browser source and renders the lot.
      </p>

      <div className="relative mt-10 max-w-4xl">
        {/* The line rides behind the chips only where they hold one row. */}
        <div className="absolute inset-x-0 top-1/2 hidden h-px md:block signal-grad-x opacity-40" aria-hidden="true" />
        <div className="absolute inset-x-0 top-1/2 hidden h-0.5 md:block signal-grad-x signal-dash-x" aria-hidden="true" />
        <ul className="relative flex flex-wrap items-center gap-3">
          {TEMPLATE_CHIPS.map((chip) => (
            <li
              key={chip.name}
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 font-mono text-xs text-foreground"
            >
              <chip.icon className="h-3.5 w-3.5 text-[#3b82f6]" aria-hidden="true" />
              {chip.name}
            </li>
          ))}
        </ul>
      </div>

      <dl className="mt-10 grid max-w-3xl gap-x-10 gap-y-6 sm:grid-cols-2">
        <div>
          <dt className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Code2 className="h-4 w-4 text-[#3b82f6]" aria-hidden="true" />
            Build your own widgets
          </dt>
          <dd className="mt-1 text-sm text-muted-foreground">
            A real code editor, typed settings fields, and test events you fire yourself. Publish to the community
            library when it is good. Full API reference in the docs.
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-foreground">Media library</dt>
          <dd className="mt-1 text-sm text-muted-foreground">
            Upload alert images, sounds and video loops once, then use them in any widget. 100 MB free, 1 GB on any
            Cloud OBS plan.
          </dd>
        </div>
      </dl>

      <p className="mt-6 font-mono text-xs text-muted-foreground/70">The overlay editor is desktop-only for now.</p>

      <div className="mt-8 flex flex-wrap items-center gap-5">
        <Link
          href="/overlays"
          className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Explore overlays
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          href={`${docsLink}/widgets/overview`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
        >
          Widget API docs
        </Link>
      </div>
    </div>
  );
}
