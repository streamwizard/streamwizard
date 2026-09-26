"use client";

import type { ComponentType, ReactNode } from "react";
import { cn, Label, ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { InspectorHint } from "../editor/inspector-hint";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: ComponentType<{ className?: string }>;
}

export interface SegmentedFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  /** Explanation behind a "?" next to the label. */
  hint?: ReactNode;
  className?: string;
  onChange: (value: T) => void;
}

/**
 * Pick one of a few options, all visible at once. Clicking the selected one
 * again does nothing: there is always exactly one answer.
 */
export function SegmentedField<T extends string>({
  id,
  label,
  value,
  options,
  hint,
  className,
  onChange,
}: SegmentedFieldProps<T>) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-1">
        <Label id={`${id}-label`} className="text-xs">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(v) => v && onChange(v as T)}
        variant="outline"
        size="sm"
        aria-labelledby={`${id}-label`}
        className="w-full"
      >
        {options.map(({ value: option, label: optionLabel, icon: Icon }) => (
          <ToggleGroupItem
            key={option}
            value={option}
            className="flex-1 shrink gap-1.5 text-xs"
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            <span className="truncate">{optionLabel}</span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
