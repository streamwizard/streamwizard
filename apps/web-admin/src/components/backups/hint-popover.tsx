"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@repo/ui";
import { cn } from "@/lib/utils";
import { formatWhen, relative } from "./backup-format";

// Sits above a card-wide link on a phone card, so a tap opens the popover
// instead of the detail page.
const TRIGGER =
  "relative z-10 -my-1 cursor-help rounded-sm py-1 underline decoration-dotted underline-offset-4 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none";

/** A label whose meaning opens on a tap or click. Replaces `title` on column headers. */
export function HelpLabel({ help, className, children }: { help: string; className?: string; children: React.ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger className={cn(TRIGGER, className)}>{children}</PopoverTrigger>
      <PopoverContent className="w-64 text-sm font-normal normal-case tracking-normal">{help}</PopoverContent>
    </Popover>
  );
}

/**
 * "3 h ago" with the exact time behind a tap. The popover only renders in the
 * browser, so the time is in the viewer's zone even on a server-rendered page.
 */
export function When({ iso, label, className }: { iso: string | null | undefined; label?: React.ReactNode; className?: string }) {
  if (!iso) return <span className={className}>{label ?? "never"}</span>;
  return (
    <Popover>
      <PopoverTrigger className={cn(TRIGGER, "tabular-nums", className)} suppressHydrationWarning>
        {label ?? relative(iso)}
      </PopoverTrigger>
      <PopoverContent className="w-auto px-3 py-2 text-sm">{formatWhen(iso)}</PopoverContent>
    </Popover>
  );
}
