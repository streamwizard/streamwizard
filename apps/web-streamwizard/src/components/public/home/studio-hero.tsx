"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { FaGithub } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { githubLink } from "@/lib/constant";
import { LiveBadge } from "@/components/public/signal/live-badge";
import { DemoDataTag, EdgeStat, useDemoLinkStats } from "@/components/public/signal/stats";
import { useSignalTick } from "@/components/public/signal/clock";
import { cn } from "@/lib/utils";

/*
 * The Studio: the hero is the streamer's own control room, an OBS-grammar
 * studio window. The program monitor composes the claim as a selected text
 * source over the real dashboard screenshot; the four pillars are racked as
 * scenes; Connect Twitch sits where Start Streaming lives. Brand purple owns
 * selection, red is spent only on LIVE, telemetry ticks on the shared clock.
 */

interface Scene {
  id: string;
  label: string;
  headline: string;
  sub: string;
}

const SCENES: Scene[] = [
  {
    id: "setup",
    label: "Stream Setup",
    headline: "Your whole stream setup, in one open-source toolkit.",
    sub: "Clips, overlays and analytics. Free forever, MIT-licensed, built in public.",
  },
  {
    id: "irl",
    label: "IRL / Cloud OBS",
    headline: "Stream IRL without a backpack PC.",
    sub: "Cloud OBS, SRT/SRTLA ingest and the auto scene switcher keep your stream up even when your phone's signal doesn't.",
  },
  {
    id: "overlays",
    label: "Overlays & Widgets",
    headline: "Overlays, widgets and walking stats.",
    sub: "[COPY: one line on the overlay editor and the custom widget builder]",
  },
  {
    id: "clips",
    label: "Clips & VODs",
    headline: "Clips, VODs and folders.",
    sub: "[COPY: one line on clip folders and search]",
  },
];

/** OBS-style selection frame: purple bounding box with eight square handles. */
function SourceHandles() {
  const positions = [
    "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
    "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2",
    "right-0 top-0 translate-x-1/2 -translate-y-1/2",
    "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2",
    "right-0 top-1/2 translate-x-1/2 -translate-y-1/2",
    "left-0 bottom-0 -translate-x-1/2 translate-y-1/2",
    "left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2",
    "right-0 bottom-0 translate-x-1/2 translate-y-1/2",
  ];
  return (
    <span aria-hidden="true">
      {positions.map((pos) => (
        <span key={pos} className={cn("absolute h-2 w-2 border border-[#9e7aff] bg-background", pos)} />
      ))}
    </span>
  );
}

function StatusBar() {
  const tick = useSignalTick();
  const { bitrateKbps } = useDemoLinkStats();
  const seconds = Math.floor(tick * 1.2);
  const uptime = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  const cpu = (2.4 + (Math.sin(tick * 1.7) + 1) * 0.9).toFixed(1);

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-border px-4 py-2">
      <LiveBadge />
      <EdgeStat label="uptime" value={uptime} />
      <EdgeStat label="bitrate" value={bitrateKbps.toLocaleString("en-US")} unit="kb/s" />
      <span className="hidden sm:inline-flex">
        <EdgeStat label="dropped" value="0 (0.0%)" />
      </span>
      <span className="hidden md:inline-flex">
        <EdgeStat label="cpu" value={cpu} unit="%" />
      </span>
      <span className="hidden md:inline-flex">
        <EdgeStat label="output" value="1080p60" />
      </span>
      <span className="ml-auto">
        <DemoDataTag />
      </span>
    </div>
  );
}

function MixerChannel({ name, db, meterClass }: { name: string; db: string; meterClass: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs text-muted-foreground">{name}</span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{db} dB</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-background" aria-hidden="true">
        <div
          className={cn(
            "studio-meter h-full w-full rounded-full",
            "bg-[linear-gradient(90deg,#4ade80_0%,#4ade80_70%,#facc15_100%)]",
            meterClass,
          )}
        />
      </div>
    </div>
  );
}

export function StudioHero() {
  const [activeId, setActiveId] = useState(SCENES[0].id);
  const scene = SCENES.find((s) => s.id === activeId) ?? SCENES[0];

  return (
    <section className="flex min-h-[calc(100svh-6rem)] items-center py-10">
      <div className="container mx-auto px-4">
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {/* Title bar */}
          <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-2.5">
            <span className="truncate font-mono text-xs text-muted-foreground">
              StreamWizard Studio <span className="hidden sm:inline">— untitled.scene-collection</span>
            </span>
            <span className="flex shrink-0 items-center gap-4 font-mono text-xs text-muted-foreground">
              <span className="hidden uppercase tracking-widest sm:inline">MIT license</span>
              <Link
                href={githubLink}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-foreground"
              >
                <FaGithub className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">StreamWizard on GitHub</span>
              </Link>
            </span>
          </div>

          <div className="grid lg:grid-cols-[minmax(0,1fr)_280px]">
            {/* Program monitor */}
            <div className="relative flex min-h-[420px] flex-col justify-center overflow-hidden bg-black p-8 md:min-h-[520px] md:p-14">
              <Image
                src="/img/landing-page/hero-dark.webp"
                alt=""
                fill
                priority
                sizes="(min-width: 1024px) 70vw, 100vw"
                className="pointer-events-none object-cover object-left-top opacity-25"
              />
              <div
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.55)_0%,rgba(0,0,0,0.75)_100%)]"
                aria-hidden="true"
              />

              <span className="absolute left-4 top-3 font-mono text-[10px] uppercase tracking-widest text-muted-foreground md:left-6 md:top-4">
                Program · {scene.label}
              </span>

              <div key={scene.id} className="relative motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
                <div className="relative inline-block border-2 border-[#9e7aff]/70 p-4 md:p-6">
                  <SourceHandles />
                  <h1 className="max-w-2xl text-3xl font-bold tracking-tight text-foreground sm:text-4xl md:text-5xl">
                    {scene.headline}
                  </h1>
                </div>
                <p className="mt-5 max-w-xl pl-4 text-base text-muted-foreground md:pl-6 md:text-lg">{scene.sub}</p>
              </div>
            </div>

            {/* Docks */}
            <div className="flex flex-col border-t border-border lg:border-l lg:border-t-0">
              <div className="flex-1">
                <h2 className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Scenes
                </h2>
                <ul className="p-2">
                  {SCENES.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        aria-pressed={s.id === activeId}
                        onClick={() => setActiveId(s.id)}
                        className={cn(
                          "w-full rounded-md px-3 py-2 text-left text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9e7aff]",
                          s.id === activeId
                            ? "bg-[#9e7aff] font-medium text-[oklch(0.145_0_0)]"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="hidden border-t border-border lg:block">
                <h2 className="border-b border-border px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  Audio Mixer
                </h2>
                <div className="space-y-4 p-4">
                  <MixerChannel name="Mic/Aux" db="-14.2" meterClass="studio-meter-a" />
                  <MixerChannel name="Desktop Audio" db="-22.6" meterClass="studio-meter-b" />
                </div>
              </div>
            </div>
          </div>

          {/* Controls dock */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3 sm:justify-end">
            <Link
              href="https://docs.streamwizard.org"
              target="_blank"
              rel="noopener noreferrer"
              className="mr-auto text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Read the docs
            </Link>
            <Link
              href={githubLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              <FaGithub className="h-4 w-4" aria-hidden="true" />
              Star on GitHub
            </Link>
            <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="hero" />
          </div>

          <StatusBar />
        </div>
      </div>
    </section>
  );
}
