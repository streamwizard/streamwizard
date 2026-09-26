"use client";

import type { ReactNode } from "react";
import { cn, Label, Switch } from "@repo/ui";
import { InspectorHint } from "../editor/inspector-hint";

export interface SwitchFieldProps {
  id: string;
  label: string;
  checked: boolean;
  /** Explanation behind a "?" next to the label. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  onCheckedChange: (checked: boolean) => void;
}

/** An on/off setting: label on the left, switch on the right, the label toggles it too. */
export function SwitchField({
  id,
  label,
  checked,
  hint,
  disabled,
  className,
  onCheckedChange,
}: SwitchFieldProps) {
  return (
    <div className={cn("flex min-h-7 items-center justify-between gap-2", className)}>
      <div className="flex min-w-0 items-center gap-1">
        <Label htmlFor={id} className="cursor-pointer text-xs font-normal">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} />
    </div>
  );
}
