"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { SignalClockProvider } from "@/components/public/signal/clock";
import { StudioHero } from "@/components/public/home/studio-hero";
import { ChatRailHero } from "./chat-rail";
import { DeparturesHero } from "./departures-board";
import { CanonHero } from "./canon";

/*
 * Prototype picker harness (PICKER.md behavior contract). Renders one variant
 * at a time, full size; switching is instant and re-mounts the variant so
 * entrance motion re-runs. 1-4 / arrows switch, R replays. Selection persists
 * via ?v=.
 */

const VARIANTS: { name: string; render: () => React.ReactNode }[] = [
  { name: "Studio", render: () => <StudioHero /> },
  { name: "Chat Rail", render: () => <ChatRailHero /> },
  { name: "Departures", render: () => <DeparturesHero /> },
  { name: "Canon", render: () => <CanonHero /> },
];

export function PrototypeHarness() {
  const [current, setCurrent] = useState(0);
  const [mountKey, setMountKey] = useState(0);
  const pickerRef = useRef<HTMLElement>(null);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Initial selection from ?v=, then enable the highlight slide after first paint.
  useEffect(() => {
    const v = parseInt(new URLSearchParams(window.location.search).get("v") ?? "", 10);
    if (v >= 1 && v <= VARIANTS.length) setCurrent(v - 1);
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(() => pickerRef.current?.setAttribute("data-ready", "")),
    );
    return () => cancelAnimationFrame(raf);
  }, []);

  useLayoutEffect(() => {
    const el = itemRefs.current[current];
    const highlight = highlightRef.current;
    if (!el || !highlight) return;
    highlight.style.width = `${el.offsetWidth}px`;
    highlight.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  useEffect(() => {
    const onResize = () => {
      const el = itemRefs.current[current];
      const highlight = highlightRef.current;
      if (!el || !highlight) return;
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [current]);

  const setActive = (i: number) => {
    if (i < 0 || i >= VARIANTS.length) return;
    setCurrent(i);
    setMountKey((k) => k + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("v", String(i + 1));
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= VARIANTS.length) setActive(num - 1);
      else if (e.key === "ArrowRight") setActive((current + 1) % VARIANTS.length);
      else if (e.key === "ArrowLeft") setActive((current - 1 + VARIANTS.length) % VARIANTS.length);
      else if (e.key === "r" || e.key === "R") setMountKey((k) => k + 1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current]);

  return (
    <div className="min-h-svh bg-background text-foreground">
      <SignalClockProvider>
        <div key={mountKey}>{VARIANTS[current].render()}</div>
      </SignalClockProvider>

      <nav className="proto-picker" ref={pickerRef} aria-label="Prototype variants">
        <span className="proto-picker-highlight" ref={highlightRef} aria-hidden="true" />
        {VARIANTS.map((v, i) => (
          <button
            key={v.name}
            type="button"
            className="proto-picker-item"
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            {...(i === current ? { "data-active": true, "aria-current": "true" as const } : {})}
            onClick={() => setActive(i)}
          >
            {v.name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button
          type="button"
          className="proto-picker-item proto-picker-replay"
          aria-label="Replay animation (R)"
          onClick={() => setMountKey((k) => k + 1)}
        >
          ↻
        </button>
      </nav>
    </div>
  );
}
