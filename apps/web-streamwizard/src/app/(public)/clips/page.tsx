import { CalendarIcon } from "@radix-ui/react-icons";
import { Clapperboard, Database, Filter, FolderIcon, Layers, SearchIcon, VideoIcon, Search } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { BentoCard, BentoGrid } from "@repo/ui";
import TwitchLogin from "@/components/buttons/twitch-login";
import { CalendarBackground } from "@/components/public/calendar-background";
import { ClipFoldersBackground } from "@/components/public/clip-folders-background";
import { SearchFilterBackground } from "@/components/public/search-filter-background";
import { VodPlayerBackground } from "@/components/public/vod-player-background";
import { DocsBand } from "@/components/public/signal/docs-band";
import { DemoDataTag, HeroEdgeStat } from "@/components/public/signal/stats";
import { SegmentHero } from "@/components/public/signal/segment-hero";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { docsClipsLink, docsLink } from "@/lib/constant";
import { absoluteUrl } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Clips & VODs",
  description:
    "Every Twitch clip you have, synced into folders and searchable by game, date or title. Plus a VOD player for the moments nobody clipped.",
  alternates: { canonical: absoluteUrl("/clips") },
};

/*
 * Feature copy below is the incumbent live copy, kept verbatim (it already
 * follows docs/tone_of_voice.md). CTAs point at the docs instead of the
 * auth-gated dashboard, which was a dead end for signed-out visitors. Every
 * background is a mock UI with synthetic numbers, so each card carries the
 * demo-data label.
 */
function demoBackground(node: React.ReactNode) {
  return (
    <div className="relative h-full">
      {node}
      <span className="absolute right-3 top-3 z-10">
        <DemoDataTag />
      </span>
    </div>
  );
}

const features = [
  {
    Icon: FolderIcon,
    name: "Clip folders",
    description: "Create folders and sort your highlights by game, date, or vibe. Not by whatever random order Twitch dumped them in.",
    href: `${docsLink}/clips/folders`,
    cta: "How folders work",
    className: "col-span-1 md:col-span-1",
    background: demoBackground(<ClipFoldersBackground />),
  },
  {
    Icon: SearchIcon,
    name: "Search any clip",
    description: "Search by game, streamer, title, or date range. Find the moment in seconds, not hours.",
    href: `${docsLink}/clips/filtering`,
    cta: "How search works",
    className: "col-span-1 md:col-span-2",
    background: demoBackground(<SearchFilterBackground />),
  },
  {
    Icon: VideoIcon,
    name: "VOD player",
    description: "Find your most epic moments inside your full VODs. Not just the clips Twitch already cut.",
    href: docsClipsLink,
    cta: "Read the docs",
    className: "col-span-1 md:col-span-2",
    background: demoBackground(<VodPlayerBackground />),
  },
  {
    Icon: CalendarIcon,
    name: "Filter by date",
    description: "Pick any date range and see exactly what you clipped. No guessing.",
    href: `${docsLink}/clips/filtering`,
    cta: "How filters work",
    className: "col-span-1 md:col-span-1",
    background: demoBackground(<CalendarBackground />),
  },
];

/* The clip journey in the page's own grammar: four stations on a short line. */
const STEPS = [
  { icon: Database, name: "Connect", copy: "Log in with your Twitch account" },
  { icon: Filter, name: "Sync", copy: "Your clips import automatically" },
  { icon: Layers, name: "Organize", copy: "Folders, by game, date, or vibe" },
  { icon: Search, name: "Search", copy: "Find any clip instantly" },
];

export default function ClipsPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <SignalClockProvider>
        <SegmentHero
          icon={Clapperboard}
          tone="text-[#4ade80]"
          station="clip sync · VOD player"
          stat={<HeroEdgeStat label="clips synced" base={847} spread={6} />}
          title="No more scrolling through 847 untagged clips."
          lede="Every clip synced, sorted into folders and searchable by game, date or title. Plus a VOD player for the moments nobody clipped."
        >
          <TwitchLogin redirect="/dashboard/clips" text="See your clips" variant="default" size="lg" source="clips-page" />
        </SegmentHero>

        <section className="container mx-auto px-4 pb-20">
          <div className="relative">
            <div className="absolute inset-x-8 top-5 hidden h-px md:block signal-grad-x opacity-40" aria-hidden="true" />
            <div className="absolute inset-x-8 top-5 hidden h-0.5 md:block signal-grad-x signal-dash-x" aria-hidden="true" />
            <ol className="relative grid gap-8 sm:grid-cols-2 md:grid-cols-4 md:gap-0 md:text-center">
              {STEPS.map((step) => (
                <li key={step.name} className="flex items-center gap-4 md:flex-col md:gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-card text-[#4ade80]" aria-hidden="true">
                    <step.icon className="h-4.5 w-4.5" />
                  </span>
                  <span className="md:mx-auto md:max-w-[180px]">
                    <span className="block text-sm font-semibold text-foreground">{step.name}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{step.copy}</span>
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="container mx-auto px-4 pb-20">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg shadow-black/40">
            <Image
              src="/img/landing-page/hero-dark.webp"
              alt="The StreamWizard dashboard showing a Twitch clip library sorted into folders"
              width={2539}
              height={1271}
              sizes="100vw"
              className="h-auto w-full"
              priority
            />
          </div>
        </section>

        <section className="container mx-auto px-4 pb-20">
          <BentoGrid className="mx-auto grid-cols-1 md:grid-cols-3">
            {features.map((feature) => (
              <BentoCard key={feature.name} {...feature} />
            ))}
          </BentoGrid>
        </section>

        <div className="container mx-auto px-4 pb-16">
          <DocsBand
            href={docsClipsLink}
            label="Clips docs"
            copy="Folders, filters and how sync works, explained in the docs."
          />
        </div>
      </SignalClockProvider>
    </div>
  );
}
