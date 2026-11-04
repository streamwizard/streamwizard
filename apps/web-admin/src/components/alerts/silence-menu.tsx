"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { BellOff, ChevronDown } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@repo/ui";
import { silenceAlert } from "@/actions/alerts/silence";

const DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "8 hours", hours: 8 },
  { label: "24 hours", hours: 24 },
];

export function SilenceMenu({ stateId, silenced }: { stateId: string; silenced: boolean }) {
  const [pending, startTransition] = useTransition();
  const silence = async (hours: number | null) => {
    const { error } = await silenceAlert(stateId, hours);
    if (error) toast.error(error);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={pending} className="h-9 gap-1 text-xs md:h-7">
          <BellOff className="size-3.5" />
          {silenced ? "Silenced" : "Silence"}
          <ChevronDown className="size-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {DURATIONS.map(({ label, hours }) => (
          <DropdownMenuItem key={hours} onClick={() => startTransition(() => silence(hours))}>
            Silence for {label}
          </DropdownMenuItem>
        ))}
        {silenced && (
          <DropdownMenuItem onClick={() => startTransition(() => silence(null))}>
            Unsilence
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
