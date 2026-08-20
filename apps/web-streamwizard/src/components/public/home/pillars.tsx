import Link from "next/link";
import { ArrowRight, Bell, Clapperboard, MapPin, Timer } from "lucide-react";
import { docsClipsLink, docsLink } from "@/lib/constant";
import { RevealGroup } from "./reveal";

/*
 * The four product surfaces in an asymmetric grid: Cloud OBS and analytics
 * get the wide cards, overlays and clips sit between them. Each visual is a
 * small honest sketch of the real surface, not a fake screenshot.
 */

const scenes = ["Starting soon", "IRL", "Connection lost", "BRB"];

function LiveDot() {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-semibold uppercase tracking-widest text-destructive">
      <span className="relative flex h-2 w-2" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive" />
      </span>
      Live
    </span>
  );
}

function DocsLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-6 inline-flex items-center gap-1 text-sm text-purple-300 transition-colors hover:text-purple-200"
    >
      Read the docs
      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

function CloudObsCard() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.14]">
      <div className="flex items-start justify-between gap-4">
        <h3 className="text-xl font-semibold">Cloud OBS for IRL streaming</h3>
        <LiveDot />
      </div>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        Stream IRL without a PC. OBS runs in our cloud, your phone streams into it, and the deck
        runs the show from your pocket.
      </p>
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-hidden="true">
        {scenes.map((scene, i) => (
          <div
            key={scene}
            className={
              "truncate rounded-xl border p-3 font-mono text-xs transition-colors " +
              (i === 1
                ? "border-purple-500/50 bg-purple-500/10 text-purple-300"
                : "border-white/[0.07] bg-white/[0.04] text-muted-foreground")
            }
          >
            {scene}
          </div>
        ))}
      </div>
      <DocsLink href={docsLink} />
    </div>
  );
}

const widgetChips = [
  { icon: Bell, name: "Alerts" },
  { icon: Clapperboard, name: "Clips" },
  { icon: Timer, name: "Countdown" },
  { icon: MapPin, name: "Walking stats" },
];

function OverlaysCard() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.14]">
      <h3 className="text-xl font-semibold">Overlays and widgets</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Alerts and widgets for your own OBS or our cloud OBS. One browser source, no code
        needed.
      </p>
      <div className="mt-6 flex flex-wrap gap-2" aria-hidden="true">
        {widgetChips.map(({ icon: Icon, name }) => (
          <span
            key={name}
            className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.04] px-2.5 py-1 text-xs text-muted-foreground"
          >
            <Icon className="h-3 w-3" />
            {name}
          </span>
        ))}
      </div>
      <DocsLink href={docsLink} />
    </div>
  );
}

function ClipsCard() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.14]">
      <h3 className="text-xl font-semibold">Twitch clips and VODs</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Every clip from your channel synced, searchable, and sorted into folders. Cut new clips
        straight from a VOD timeline.
      </p>
      <div className="mt-6 flex gap-2" aria-hidden="true">
        {["0:23", "0:47", "0:31"].map((duration, i) => (
          <div
            key={duration}
            className={
              "relative aspect-video flex-1 rounded-lg border border-white/[0.07] bg-linear-to-br " +
              (i === 0
                ? "from-purple-500/25 to-slate-900/60"
                : i === 1
                  ? "from-amber-500/20 to-slate-900/60"
                  : "from-purple-400/15 to-slate-900/60")
            }
          >
            <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 font-mono text-[10px] text-white">
              {duration}
            </span>
          </div>
        ))}
      </div>
      <DocsLink href={docsClipsLink} />
    </div>
  );
}

function AnalyticsCard() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 transition-colors hover:border-white/[0.14]">
      <h3 className="text-xl font-semibold">Stream analytics</h3>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
        What happened last stream, minute by minute. Follows, subs, and clips plotted on your viewer
        graph.
      </p>
      <div className="mt-6" aria-hidden="true">
        <svg viewBox="0 0 200 48" className="h-12 w-full" preserveAspectRatio="none">
          <polyline
            points="0,42 20,36 40,31 60,27 80,24 100,25 110,10 120,6 140,12 160,16 180,19 200,21"
            fill="none"
            stroke="var(--color-three)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="mt-2 flex items-baseline justify-between font-mono text-xs text-muted-foreground">
          <span>Peak viewers</span>
          <span className="text-base font-bold tabular-nums text-foreground">214</span>
        </div>
      </div>
      <DocsLink href={docsLink} />
    </div>
  );
}

export function Pillars() {
  return (
    <section className="py-20">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-medium text-purple-300">
            The platform
            1          </span>
          <h2 className="mt-4 text-3xl font-bold sm:text-4xl">
            Streamer tools, duct-taped together.
          </h2>
        </div>
        <RevealGroup
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          items={[
            { node: <CloudObsCard />, className: "h-full min-w-0 lg:col-span-2" },
            { node: <OverlaysCard />, className: "h-full min-w-0" },
            { node: <ClipsCard />, className: "h-full min-w-0" },
            { node: <AnalyticsCard />, className: "h-full min-w-0 lg:col-span-2" },
          ]}
        />
      </div>
    </section>
  );
}
