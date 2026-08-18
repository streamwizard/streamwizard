import Link from "next/link";
import { ArrowRight, Footprints, Gauge, TabletSmartphone } from "lucide-react";
import { docsLink } from "@/lib/constant";

/*
 * The spearhead pillar. Proof artifact is an authored deck illustration (the
 * phone streamdeck is auth-gated and noindexed, so the page shows it instead
 * of linking into it).
 */

const FEATURES = [
  {
    icon: Gauge,
    name: "Auto scene-switcher",
    copy: "Watches bitrate, RTT and packet loss once a second, then switches to your backup scene before chat sees the drop. Three presets: relaxed, balanced, fast.",
  },
  {
    icon: TabletSmartphone,
    name: "Phone deck",
    copy: "A remote built for one thumb. Scenes, live chat, stream info and switcher sensitivity, four tabs on the phone already in your hand.",
  },
  {
    icon: Footprints,
    name: "IRL overlays",
    copy: "Overlays fed by your phone's GPS, burned into the outgoing video. Walking stats is the ready-made one: speed, distance, location and weather, with distance resetting when your stream starts.",
  },
];

function DeckIllustration() {
  return (
    <figure className="mx-auto w-full max-w-[260px]">
      <div className="rounded-[2rem] border border-border bg-card p-3 shadow-lg shadow-black/40">
        <div className="rounded-[1.4rem] border border-border/60 bg-background p-3">
          <div className="flex items-center justify-between px-1">
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">deck</span>
            <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-[#4ade80]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#4ade80]" aria-hidden="true" />
              on air
            </span>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-[#9e7aff]/60 bg-[#9e7aff]/15 px-2 py-4 text-center text-xs font-semibold text-foreground">
              IRL Cam
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-4 text-center text-xs text-muted-foreground">
              Low bitrate
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-4 text-center text-xs text-muted-foreground">
              BRB
            </div>
            <div className="rounded-lg border border-border bg-card px-2 py-4 text-center text-xs text-muted-foreground">
              Starting
            </div>
          </div>
          <div className="mt-2 rounded-lg border border-border bg-card px-3 py-2">
            <span className="font-mono text-[10px] text-muted-foreground">switcher held · release to resume</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        illustration
      </figcaption>
    </figure>
  );
}

export function IrlSection() {
  return (
    <div className="grid items-start gap-10 lg:grid-cols-[1fr_auto] lg:gap-16">
      <div>
        <p className="max-w-2xl text-base text-muted-foreground md:text-lg">
          Stream from anywhere without a PC. Your phone feeds an ingest node, a cloud OBS renders the stream, and
          chat never sees the signal dip.
        </p>
        <ul className="mt-8 space-y-6">
          {FEATURES.map((feature) => (
            <li key={feature.name} className="flex gap-4">
              <feature.icon className="mt-1 h-5 w-5 shrink-0 text-[#9e7aff]" aria-hidden="true" />
              <div>
                <h3 className="text-base font-semibold text-foreground">{feature.name}</h3>
                <p className="mt-1 max-w-xl text-sm text-muted-foreground">{feature.copy}</p>
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <Link
            href="/cloud-obs"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Explore Cloud OBS
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link
            href={`${docsLink}/irl/overview`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
          >
            IRL docs
          </Link>
        </div>
      </div>
      <DeckIllustration />
    </div>
  );
}
