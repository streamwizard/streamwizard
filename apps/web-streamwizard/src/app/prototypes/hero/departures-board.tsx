"use client";

import Link from "next/link";
import { FaGithub } from "react-icons/fa";
import TwitchLogin from "@/components/buttons/twitch-login";
import { githubLink } from "@/lib/constant";
import { DemoDataTag } from "@/components/public/signal/stats";
import { useSignalTick } from "@/components/public/signal/clock";

/*
 * Prototype variant: The Departures Board. The toolkit as a live gate board:
 * every pillar a row, statuses honest, one amber alert held on the boarding
 * row. A boarding-pass strip carries the MIT license as the scannable block.
 */

const ROWS = [
  { dest: "Clips & VODs", gate: "folders", status: "FREE", alert: false },
  { dest: "Overlays & Widgets", gate: "editor", status: "FREE", alert: false },
  { dest: "Stream Analytics", gate: "hourly", status: "FREE", alert: false },
  { dest: "Cloud OBS / IRL", gate: "srt-la", status: "NOW BOARDING", alert: true },
  { dest: "Community", gate: "github", status: "OPEN SOURCE", alert: false },
];

function BoardClock() {
  const tick = useSignalTick();
  const seconds = Math.floor(tick * 1.2);
  const clock = [Math.floor(seconds / 3600) % 24, Math.floor((seconds % 3600) / 60), seconds % 60]
    .map((n) => String(n).padStart(2, "0"))
    .join(":");
  return <span className="font-mono text-sm tabular-nums text-foreground/90">{clock}</span>;
}

export function DeparturesHero() {
  return (
    <section className="flex min-h-svh items-center py-10">
      <div className="container mx-auto max-w-4xl px-4">
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Your whole stream setup, in one open-source toolkit.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
          Clips, overlays and analytics. Free forever, MIT-licensed, built in public.
        </p>

        {/* The board */}
        <div className="mt-10 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              StreamWizard · departures
            </span>
            <BoardClock />
          </div>

          <div
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-6 px-4 font-mono text-sm sm:grid-cols-[minmax(0,1fr)_6rem_auto]"
            role="table"
            aria-label="Toolkit departures"
          >
            <div role="row" className="col-span-full grid grid-cols-subgrid border-b border-border py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <span role="columnheader">Destination</span>
              <span role="columnheader" className="hidden sm:block">
                Gate
              </span>
              <span role="columnheader" className="text-right">
                Status
              </span>
            </div>
            {ROWS.map((row) => (
              <div
                key={row.dest}
                role="row"
                className="col-span-full grid grid-cols-subgrid items-baseline border-b border-border py-3 last:border-b-0"
              >
                <span role="cell" className="truncate text-foreground/90">
                  {row.dest}
                </span>
                <span role="cell" className="hidden text-muted-foreground sm:block">
                  {row.gate}
                </span>
                <span
                  role="cell"
                  className={`text-right text-xs uppercase tracking-widest ${
                    row.alert ? "proto-flap font-semibold text-[#ffb400]" : "text-muted-foreground"
                  }`}
                >
                  {row.status}
                </span>
              </div>
            ))}
          </div>

          {/* Boarding-pass strip */}
          <div className="flex flex-wrap items-center gap-4 border-t border-dashed border-border px-4 py-3">
            <span
              aria-hidden="true"
              className="h-8 w-24 shrink-0 bg-[repeating-linear-gradient(90deg,var(--foreground)_0_2px,transparent_2px_5px)] opacity-60"
            />
            <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
              MIT license · all core tools free
            </span>
            <span className="ml-auto">
              <DemoDataTag />
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <TwitchLogin redirect="/dashboard" text="Connect Twitch" variant="default" size="lg" source="hero-proto-board" />
          <Link
            href={githubLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-transparent px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            <FaGithub className="h-4 w-4" aria-hidden="true" />
            Star on GitHub
          </Link>
        </div>
      </div>
    </section>
  );
}
