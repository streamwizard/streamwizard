"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@repo/ui";

// Collapsible inspector section: the editor shows the essentials expanded and
// tucks everything else behind these, so new users aren't hit with every
// option at once. State is per-mount on purpose - reselecting an item resets
// to the calm default.
export function InspectorSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
      >
        <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} />
        {title}
      </button>
      {open && children}
    </div>
  );
}
