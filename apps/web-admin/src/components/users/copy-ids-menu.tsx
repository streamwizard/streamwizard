"use client";

import { toast } from "sonner";
import { ChevronDown, Copy } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";

/** The user's ids behind one button, for phones where three mono ids don't fit in the header. */
export function CopyIdsMenu({ ids, className }: { ids: { label: string; value: string }[]; className?: string }) {
  const copy = async ({ label, value }: { label: string; value: string }) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} ID copied.`);
    } catch {
      // Clipboard blocked (insecure origin, permissions): show it so it can be copied by hand.
      toast.message(`${label} ID`, { description: value, duration: 15_000 });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={className}>
          <Copy className="size-3.5" aria-hidden />
          Copy IDs
          <ChevronDown className="size-3.5 opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-2rem)]">
        {ids.map((id) => (
          <DropdownMenuItem key={id.label} className="min-h-11 flex-col items-start gap-0.5" onSelect={() => copy(id)}>
            <span>{id.label} ID</span>
            <span className="w-full truncate font-mono text-xs text-muted-foreground">{id.value}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
