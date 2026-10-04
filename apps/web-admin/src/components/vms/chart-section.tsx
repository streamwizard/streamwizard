"use client";

import { Children, useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@repo/ui";
import { SectionHeading } from "@/components/widgets/section-heading";
import { ChartGrid } from "@/components/widgets/stat-grid";
import { useWideScreen } from "@/hooks/use-wide-screen";
import { cn } from "@/lib/utils";

/**
 * A titled group of charts. Always open from 768px up. On a phone it starts
 * closed behind a toggle, and closed means not mounted: a page with a dozen
 * charts would otherwise poll and draw all of them under the fold.
 */
export function ChartSection({
  title,
  hint,
  gridClassName,
  children,
}: {
  title: string;
  hint?: string;
  /** Overrides the column count where the section sits in a narrow column. */
  gridClassName?: string;
  children: React.ReactNode;
}) {
  const wide = useWideScreen();
  const [open, setOpen] = useState(false);
  const id = useId();
  // toArray drops the empty nodes a `cond && <Chart />` leaves behind.
  const count = Children.toArray(children).length;

  return (
    <section className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading>{title}</SectionHeading>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 shrink-0 md:hidden"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide" : count === 1 ? "Show chart" : `Show ${count} charts`}
          <ChevronDown className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
        </Button>
      </div>
      {/* Until the browser says how wide it is, CSS decides, so neither size flashes. */}
      {(wide === null || wide || open) && (
        <div id={id} className={cn(wide === null && "hidden md:block")}>
          <ChartGrid className={gridClassName}>{children}</ChartGrid>
        </div>
      )}
    </section>
  );
}
