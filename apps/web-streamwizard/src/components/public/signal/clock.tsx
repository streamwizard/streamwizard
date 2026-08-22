"use client";

import { createContext, useContext, useEffect, useState } from "react";

/*
 * One clock for the whole page. Every live element on the marketing surface
 * (edge stats, chart bars, pulses) ticks from this single interval so the page
 * breathes on one beat instead of a dozen unsynchronized timers. The CSS
 * signal-march animations run at 1.2s — one dash cycle per tick — so dash
 * motion and number motion stay in phase.
 */
const TICK_MS = 1200;

const ClockContext = createContext(0);

export function SignalClockProvider({ children }: { children: React.ReactNode }) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  return <ClockContext.Provider value={tick}>{children}</ClockContext.Provider>;
}

export function useSignalTick(): number {
  return useContext(ClockContext);
}
