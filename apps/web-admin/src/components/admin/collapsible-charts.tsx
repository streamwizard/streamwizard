"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui";
import { useWideScreen } from "@/hooks/use-wide-screen";
import { cn } from "@/lib/utils";

/**
 * Charts are always open from 768px up. On a phone they start folded behind a
 * button and are not mounted until it is tapped, so a page with ten charts
 * opens on its lists instead of a long scroll of graphs.
 */
export function CollapsibleCharts({ children }: { children: React.ReactNode }) {
  const wide = useWideScreen();
  const [open, setOpen] = useState(false);
  // Until the browser answers, keep the server markup: CSS hides it on a phone.
  const mounted = open || wide !== false;

  return (
    <div className="space-y-4">
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full justify-between md:hidden"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide charts" : "Show charts"}
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </Button>
      {mounted && <div className={cn("space-y-6", !open && "hidden md:block")}>{children}</div>}
    </div>
  );
}
