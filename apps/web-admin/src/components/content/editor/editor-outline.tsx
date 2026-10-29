"use client";

import { useEffect, useState, type RefObject } from "react";
import type { TocEntry } from "@repo/cms";
import { cn } from "@/lib/utils";

// The page's headings as a list the writer can jump around with. The
// entries come from the draft (same outline the site builds); the elements
// are found in the editor by document order: every heading inside a
// ProseMirror surface plus every guide section title, which is also the
// order pageOutline walks. The heading that last crossed the upper 40% of the
// viewport is marked as current.

/** Every element that turns into an outline entry, in document order. */
export const OUTLINE_TARGETS = ".ProseMirror :is(h2, h3, h4), [data-outline-section]";

const READING_LINE = 0.4;

function currentIndex(targets: HTMLElement[]): number {
  const line = window.innerHeight * READING_LINE;
  let current = -1;
  targets.forEach((target, index) => {
    // A heading in a folded section has no box: it can't be where the reader is.
    if (target.getClientRects().length > 0 && target.getBoundingClientRect().top <= line) current = index;
  });
  return current;
}

export function EditorOutline({
  entries,
  root,
  onUnfold,
}: {
  entries: TocEntry[];
  root: RefObject<HTMLElement | null>;
  /** Opens a folded guide section so a heading inside it can be shown. */
  onUnfold?: (sectionId: string) => void;
}) {
  const [active, setActive] = useState(-1);
  // Re-find the elements whenever the outline changes shape.
  const shape = entries.map((entry) => `${entry.level}:${entry.anchor}`).join(" ");

  useEffect(() => {
    const container = root.current;
    if (!container) return;
    const targets = [...container.querySelectorAll<HTMLElement>(OUTLINE_TARGETS)];
    if (targets.length === 0) return;
    const update = () => setActive(currentIndex(targets));
    // One watches the reading line, the other the whole viewport, so a jump
    // that skips the line still moves some heading in or out of view.
    const observers = [`0px 0px -${100 - READING_LINE * 100}% 0px`, "0px"].map(
      (rootMargin) => new IntersectionObserver(update, { rootMargin }),
    );
    for (const observer of observers) for (const target of targets) observer.observe(target);
    update();
    return () => observers.forEach((observer) => observer.disconnect());
  }, [shape, root]);

  const jump = (index: number) => {
    const target = root.current?.querySelectorAll<HTMLElement>(OUTLINE_TARGETS)[index];
    if (!target) return;
    const folded = target.closest<HTMLElement>("[data-folded]");
    if (folded?.dataset.sectionId && onUnfold) {
      onUnfold(folded.dataset.sectionId);
      // Scroll once the section's text is back on screen.
      return void requestAnimationFrame(() => requestAnimationFrame(() => show(target)));
    }
    show(target);
  };

  const show = (target: HTMLElement) => {
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
    // A section title is an input: put the caret there, ready to edit.
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
      target.focus({ preventScroll: true });
  };

  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Headings show up here as you write. Add an H2 to the text, or a section to a guide.
      </p>
    );
  }

  return (
    <ol className="space-y-px border-l text-sm">
      {entries.map((entry, index) => (
        <li key={entry.anchor}>
          <button
            type="button"
            onClick={() => jump(index)}
            aria-current={index === active ? "location" : undefined}
            className={cn(
              "relative block w-full truncate rounded-r-md py-1.5 pr-2 text-left text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              "before:absolute before:inset-y-1 before:-left-px before:w-px before:bg-foreground before:opacity-0",
              "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
              entry.level === 2 ? "pl-3" : entry.level === 3 ? "pl-6" : "pl-9",
              index === active && "text-foreground before:opacity-100",
            )}
          >
            {entry.text || <em>Untitled</em>}
          </button>
        </li>
      ))}
    </ol>
  );
}
