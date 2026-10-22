"use client";

import { useEffect, useState } from "react";
import type { TocEntry } from "@repo/cms";
import { cn } from "@/lib/utils";

// The "On this page" list. In the sidebar it follows the reader: the heading
// that last crossed the upper 40% of the viewport is marked as current. An
// IntersectionObserver wakes it only when a heading crosses that line, so
// there's no scroll listener.

const READING_LINE = 0.4;

function currentAnchor(headings: HTMLElement[]): string | null {
  const line = window.innerHeight * READING_LINE;
  let current: string | null = null;
  for (const heading of headings) {
    if (heading.getBoundingClientRect().top > line) break;
    current = heading.id;
  }
  return current;
}

export function ArticleToc({ entries, track = false }: { entries: TocEntry[]; track?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  const anchors = entries.map((entry) => entry.anchor).join(" ");

  useEffect(() => {
    if (!track) return;
    const headings = anchors
      .split(" ")
      .map((anchor) => document.getElementById(anchor))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;
    const update = () => setActive(currentAnchor(headings));
    // One watches the reading line, the other the whole viewport: a jump
    // (anchor link, End key, scrollbar drag) can skip the line entirely, but
    // it still moves some heading in or out of view.
    const observers = [`0px 0px -${100 - READING_LINE * 100}% 0px`, "0px"].map(
      (rootMargin) => new IntersectionObserver(update, { rootMargin }),
    );
    for (const observer of observers) for (const heading of headings) observer.observe(heading);
    update();
    return () => observers.forEach((observer) => observer.disconnect());
  }, [anchors, track]);

  return (
    <ol className="space-y-px border-l border-border text-sm">
      {entries.map((entry) => {
        const current = entry.anchor === active;
        return (
          <li key={entry.anchor}>
            <a
              href={`#${entry.anchor}`}
              aria-current={current ? "location" : undefined}
              className={cn(
                "relative block py-1.5 pr-2 leading-snug text-muted-foreground transition-colors hover:text-foreground",
                "before:absolute before:inset-y-1 before:-left-px before:w-px before:bg-[var(--color-three)] before:opacity-0 before:transition-opacity",
                "focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                entry.level >= 3 ? "pl-7" : "pl-4",
                current && "text-foreground before:opacity-100",
              )}
            >
              {entry.text || "Untitled section"}
            </a>
          </li>
        );
      })}
    </ol>
  );
}
