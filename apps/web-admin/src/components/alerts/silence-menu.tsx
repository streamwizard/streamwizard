"use client";

import { useTransition } from "react";
import { BellOff, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { silenceAlert } from "@/app/(monitor)/alerts/actions";

const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "8 hours", hours: 8 },
  { label: "24 hours", hours: 24 },
];

export function SilenceMenu({ stateId, silenced }: { stateId: string; silenced: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} className="h-7 gap-1 text-xs">
          <BellOff className="size-3.5" />
          {silenced ? "Silenced" : "Silence"}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DURATIONS.map(({ label, hours }) => (
          <DropdownMenuItem key={hours} onClick={() => startTransition(() => silenceAlert(stateId, hours))}>
            Silence for {label}
          </DropdownMenuItem>
        ))}
        {silenced && (
          <DropdownMenuItem onClick={() => startTransition(() => silenceAlert(stateId, null))}>
            Unsilence
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
