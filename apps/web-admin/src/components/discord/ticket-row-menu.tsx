"use client";

import { ArrowDown, ArrowUp, EllipsisVertical } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";
import type { SortableMove } from "@repo/ui/components/sortable-list";
import { cn } from "@/lib/utils";

/**
 * One row's actions behind a single 44px button. For phones: three icon
 * buttons next to a row leave no room for its name there.
 */
export function TicketRowMenu({
  label,
  disabled,
  className,
  children,
}: {
  /** "Bug", "Cloud OBS": names the row for screen readers. */
  label: string;
  disabled?: boolean;
  className?: string;
  /** `DropdownMenuItem`s. */
  children: React.ReactNode;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Actions for ${label}`}
          disabled={disabled}
          className={cn("size-10 shrink-0", className)}
        >
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44 [&_[data-slot=dropdown-menu-item]]:min-h-11">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Move up and Move down: reordering by tap, for where dragging a row is fiddly. */
export function MoveMenuItems({ move }: { move: SortableMove }) {
  return (
    <>
      <DropdownMenuItem disabled={!move.up} onSelect={move.up}>
        <ArrowUp />
        Move up
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!move.down} onSelect={move.down}>
        <ArrowDown />
        Move down
      </DropdownMenuItem>
    </>
  );
}
