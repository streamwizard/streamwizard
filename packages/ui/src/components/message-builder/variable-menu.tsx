"use client";

import { useState } from "react";
import { Braces } from "lucide-react";
import type { VariableDefinition } from "@repo/discord-message";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { ToolbarButton } from "./toolbar-button";

export function VariableMenu({
  variables,
  onPick,
  disabled,
}: {
  variables: VariableDefinition[];
  onPick: (placeholder: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (variables.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Insert a variable" disabled={disabled}>
          <Braces />
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        <p className="px-2 py-1.5 text-xs text-muted-foreground">Filled in with the real value when the message is sent.</p>
        {variables.map((variable) => (
          <button
            key={variable.key}
            type="button"
            onClick={() => {
              onPick(`[${variable.key}]`);
              setOpen(false);
            }}
            className="flex w-full items-center justify-between gap-3 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
          >
            <span>{variable.label}</span>
            <code className="text-xs text-muted-foreground">[{variable.key}]</code>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
