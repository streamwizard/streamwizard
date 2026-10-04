"use client";

import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";

/**
 * The secondary filters of a list. From 640px up they sit in the row as they
 * always did. On a phone they fold behind a "Filters" button that shows how
 * many are set. They stay inside the surrounding <form> either way, so a plain
 * GET form keeps working (a portalled drawer would take the fields out of it).
 */
export function FilterPanel({ activeCount = 0, children, className }: { activeCount?: number; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="outline" className="h-10 shrink-0 gap-1.5 sm:hidden" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <SlidersHorizontal className="size-4" aria-hidden />
        Filters
        {activeCount > 0 && (
          <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">{activeCount}</span>
        )}
      </Button>
      <div className={cn(open ? "flex" : "hidden", "w-full flex-wrap items-center gap-2 sm:contents", className)}>{children}</div>
    </>
  );
}
