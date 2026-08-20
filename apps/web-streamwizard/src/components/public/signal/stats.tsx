"use client";

import { useSignalTick } from "./clock";

/*
 * Deterministic pseudo-live values: pure functions of the shared tick, so the
 * server render (tick 0) matches the first client render and the numbers then
 * wander believably. These are demo values, and every cluster that shows them
 * carries the DemoDataTag so nobody mistakes them for a live connection.
 */
function wander(tick: number, base: number, spread: number, f1: number, f2: number): number {
  return Math.round(base + Math.sin(tick * f1) * spread * 0.7 + Math.sin(tick * f2 + 1.3) * spread * 0.3);
}

export function useDemoLinkStats() {
  const tick = useSignalTick();
  return {
    bitrateKbps: wander(tick, 6200, 600, 1.7, 0.7),
    rttMs: wander(tick, 38, 11, 1.3, 2.9),
    lossPct: (0.1 + (Math.sin(tick * 2.1) + 1) * 0.15).toFixed(1),
  };
}

export function EdgeStat({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 font-mono text-xs text-muted-foreground">
      <span className="uppercase tracking-wide opacity-70">{label}</span>
      <span className="tabular-nums text-foreground/90">{value}</span>
      {unit ? <span className="opacity-70">{unit}</span> : null}
    </span>
  );
}

/**
 * A single ticking stat for a segment hero's passing line, so the shared-clock
 * grammar reaches every cluster page. Always ships with its demo-data label.
 */
export function HeroEdgeStat({ label, base, spread, unit }: { label: string; base: number; spread: number; unit?: string }) {
  const tick = useSignalTick();
  const value = wander(tick, base, spread, 1.7, 0.7);
  return (
    <span className="inline-flex items-center gap-3 rounded-md border border-border bg-background/80 px-3 py-1.5">
      <EdgeStat label={label} value={value.toLocaleString("en-US")} unit={unit} />
      <DemoDataTag />
    </span>
  );
}

/** Honest labeling for every synthetic number on the page. */
export function DemoDataTag() {
  return (
    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground select-none">
      demo data
    </span>
  );
}
