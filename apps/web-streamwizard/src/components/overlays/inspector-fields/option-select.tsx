"use client";

import type { ReactNode } from "react";
import { Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { InspectorHint } from "@/components/overlays/editor/inspector/inspector-hint";

/** A labelled dropdown over a fixed list of string options, with an optional "?" hint. */
export function OptionSelect<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  hint,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  hint?: ReactNode;
  disabled?: boolean;
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {labels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
