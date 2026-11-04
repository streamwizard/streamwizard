"use client";

import { useMemo } from "react";

// Roughly how a post shows up in a search result. Search engines cut titles
// and descriptions by rendered width, not by characters, so the text is
// measured in the font and size they use and cut where they would.

const TITLE = { font: "20px Arial, sans-serif", width: 600 };
const DESCRIPTION = { font: "14px Arial, sans-serif", width: 920 };
/** The site's title template (app/layout.tsx in web-streamwizard). */
const TITLE_SUFFIX = " – StreamWizard";

let canvas: HTMLCanvasElement | null = null;

/** The text as it would show, cut with an ellipsis where it runs out of room. */
function fit(text: string, { font, width }: { font: string; width: number }): { shown: string; cut: boolean } {
  if (typeof document === "undefined") return { shown: text, cut: false };
  canvas ??= document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { shown: text, cut: false };
  context.font = font;
  if (context.measureText(text).width <= width) return { shown: text, cut: false };
  let end = text.length;
  while (end > 0 && context.measureText(`${text.slice(0, end).trimEnd()} …`).width > width) end--;
  return { shown: `${text.slice(0, end).trimEnd()} …`, cut: true };
}

export function SearchPreview({ title, description, path }: { title: string; description: string; path: string }) {
  const shownTitle = useMemo(() => fit(`${title || "Untitled"}${TITLE_SUFFIX}`, TITLE), [title]);
  const shownDescription = useMemo(() => fit(description, DESCRIPTION), [description]);
  const crumbs = path.split("/").filter(Boolean);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">In search results</p>
      <div className="space-y-1 rounded-md border bg-muted/30 p-3" aria-label="Search result preview">
        <p className="truncate text-xs text-muted-foreground">streamwizard.org{crumbs.map((crumb) => ` › ${crumb}`)}</p>
        <p className="text-base leading-snug text-sky-700 dark:text-sky-300">{shownTitle.shown}</p>
        {shownDescription.shown ? (
          <p className="line-clamp-3 text-xs leading-5 text-muted-foreground">{shownDescription.shown}</p>
        ) : (
          <p className="text-xs italic text-muted-foreground">
            No description yet: search engines pick a line from the page.
          </p>
        )}
      </div>
      {(shownTitle.cut || shownDescription.cut) && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {shownTitle.cut && shownDescription.cut
            ? "The title and description get cut off."
            : shownTitle.cut
              ? "The title gets cut off."
              : "The description gets cut off."}{" "}
          Shorten it so the end shows too.
        </p>
      )}
    </div>
  );
}
