import { CheckCircle2, CircleDashed, Hammer, Map } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { FaGithub } from "react-icons/fa";
import { SegmentHero } from "@/components/public/signal/segment-hero";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { Spine, SpineSection } from "@/components/public/signal/spine";
import { githubLink } from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Roadmap",
  description:
    "What StreamWizard has shipped, what is being built right now, and what is still up for debate. No dates, just state.",
  alternates: { canonical: absoluteUrl("/roadmap") },
};

/*
 * Every entry below is a verifiable state of the codebase, not a promise with
 * a date. "Shipped" = live on staging; "building" = visibly unfinished in the
 * product; "considering" = placeholder for the user's own list. No dates on
 * purpose: an open-source roadmap that misses a printed month reads as a
 * broken promise.
 */
const SHIPPED = [
  { name: "Cloud OBS", note: "a persistent OBS instance you drive from the browser" },
  { name: "Bonded SRT/SRTLA ingest", note: "with per-second link stats and key rotation" },
  { name: "Auto scene-switcher", note: "three sensitivity presets, manual override, chat notices" },
  { name: "The deck", note: "phone remote with scenes, chat, stream info and sensitivity tabs" },
  { name: "IRL overlays", note: "GPS-fed overlays, walking stats included, with server-owned distance resets" },
  { name: "Overlay templates in the database", note: "new templates without a deploy" },
  { name: "Media library", note: "R2-backed assets for every widget" },
  { name: "Stream analytics", note: "hourly viewers and category stats" },
  { name: "Discord integration", note: "account linking and role connections" },
];

const BUILDING = [
  { name: "Chat commands", note: "custom and default commands managed from the dashboard" },
  { name: "Self-serve subscriptions", note: "checkout for Cloud OBS tiers, no request step" },
  { name: "Mobile overlay editing", note: "the editor currently needs a desktop screen" },
  { name: "Ingest output routing", note: "restream your feed to more than one destination" },
];

function RoadmapList({ items, icon: Icon, tone }: { items: { name: string; note: string }[]; icon: typeof CheckCircle2; tone: string }) {
  return (
    <ul className="max-w-2xl space-y-4">
      {items.map((item) => (
        <li key={item.name} className="flex items-start gap-3">
          <Icon className={`mt-0.5 h-4.5 w-4.5 shrink-0 ${tone}`} aria-hidden="true" />
          <div>
            <span className="text-sm font-semibold text-foreground">{item.name}</span>
            <span className="ml-2 text-sm text-muted-foreground">{item.note}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function RoadmapPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SignalClockProvider>
        <SegmentHero
          icon={Map}
          tone="text-[#9e7aff]"
          station="public repo · MIT license"
          title="Where the toolkit is going."
          lede="Everything ships in the open. Watch it happen in the repo, or come argue about priorities on Discord."
        >
          <Link
            href={githubLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <FaGithub className="h-4 w-4" aria-hidden="true" />
            Follow along on GitHub
          </Link>
        </SegmentHero>

        <div className="container mx-auto px-4">
          <Spine>
            <SpineSection icon={CheckCircle2} tone="text-[#4ade80]" title="Shipped">
              <RoadmapList items={SHIPPED} icon={CheckCircle2} tone="text-[#4ade80]" />
            </SpineSection>
            <SpineSection icon={Hammer} tone="text-[#3b82f6]" title="Being built">
              <RoadmapList items={BUILDING} icon={Hammer} tone="text-[#3b82f6]" />
            </SpineSection>
            <SpineSection icon={CircleDashed} tone="text-[#9e7aff]" title="Considering" density="quiet">
              <p className="max-w-2xl text-sm text-muted-foreground">
                Nothing in this section is a promise. Ideas get weighed in Discord and in GitHub issues, and the ones
                that earn it move up to Being built. Bring yours.
              </p>
            </SpineSection>
          </Spine>
        </div>

        <div className="pb-24" />
      </SignalClockProvider>
    </div>
  );
}
