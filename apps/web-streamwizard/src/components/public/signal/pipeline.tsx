"use client";

import type { LucideIcon } from "lucide-react";
import { Cloud, Radio, Smartphone } from "lucide-react";
import { FaTwitch } from "react-icons/fa";
import { LiveBadge } from "./live-badge";
import { EdgeStat, useDemoLinkStats } from "./stats";

/*
 * The thesis piece: the IRL signal chain drawn as one live line. Horizontal on
 * desktop, vertical on mobile (same DOM, two layouts). The brand gradient
 * lives in this line and nowhere else; motion is the dash march plus the
 * ticking edge stats, both in phase with the shared clock.
 */

type Station = {
  name: string;
  meta: string;
  icon: LucideIcon | typeof FaTwitch;
  tone: string;
  live?: boolean;
};

const STATIONS: Station[] = [
  { name: "Your phone", meta: "SRT / SRTLA", icon: Smartphone, tone: "text-[#9e7aff]" },
  { name: "Ingest node", meta: "bonded links", icon: Radio, tone: "text-[#3b82f6]" },
  { name: "Cloud OBS", meta: "runs for you", icon: Cloud, tone: "text-[#4ade80]" },
  { name: "Twitch", meta: "", icon: FaTwitch, tone: "text-foreground", live: true },
];

export function PipelineBand() {
  const stats = useDemoLinkStats();

  return (
    <figure className="relative" role="img" aria-label="Diagram of the IRL signal path: your phone streams over SRT to a StreamWizard ingest node, into a cloud OBS instance, and out to Twitch.">
      {/* Mobile spine */}
      <div className="absolute left-7 top-7 bottom-7 w-px md:hidden signal-grad-y opacity-40" aria-hidden="true" />
      <div className="absolute left-7 top-7 bottom-7 w-px md:hidden signal-grad-y signal-dash-y" aria-hidden="true" />

      {/* Desktop line, drawn through the icon centers */}
      <div className="absolute inset-x-10 top-7 hidden h-px md:block signal-grad-x opacity-40" aria-hidden="true" />
      <div className="absolute inset-x-10 top-7 hidden h-0.5 md:block signal-grad-x signal-dash-x" aria-hidden="true" />

      <ol className="relative flex flex-col gap-8 md:grid md:grid-cols-4 md:gap-0">
        {STATIONS.map((station) => {
          const Icon = station.icon;
          return (
            <li key={station.name} className="flex items-center gap-4 md:flex-col md:gap-3 md:text-center">
              <span
                className={`grid h-14 w-14 shrink-0 place-items-center rounded-xl border border-border bg-card ${station.tone}`}
                aria-hidden="true"
              >
                <Icon className="h-6 w-6" />
              </span>
              <span className="flex flex-col gap-0.5 md:items-center">
                <span className="text-sm font-semibold text-foreground">{station.name}</span>
                {station.live ? (
                  <LiveBadge />
                ) : (
                  <span className="font-mono text-xs text-muted-foreground">{station.meta}</span>
                )}
              </span>
            </li>
          );
        })}
      </ol>

      {/* Edge stats at the segment midpoints (desktop) */}
      <div className="mt-6 hidden px-[12.5%] md:block" aria-hidden="true">
        <div className="grid grid-cols-3">
          <div className="flex justify-center"><EdgeStat label="bitrate" value={stats.bitrateKbps.toLocaleString("en-US")} unit="kbps" /></div>
          <div className="flex justify-center"><EdgeStat label="rtt" value={stats.rttMs} unit="ms" /></div>
          <div className="flex justify-center"><EdgeStat label="loss" value={stats.lossPct} unit="%" /></div>
        </div>
      </div>

      {/* Same stats, grouped, on mobile */}
      <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 pl-[4.5rem] md:hidden" aria-hidden="true">
        <EdgeStat label="bitrate" value={stats.bitrateKbps.toLocaleString("en-US")} unit="kbps" />
        <EdgeStat label="rtt" value={stats.rttMs} unit="ms" />
        <EdgeStat label="loss" value={stats.lossPct} unit="%" />
      </div>
    </figure>
  );
}
