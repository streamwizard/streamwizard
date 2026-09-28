"use client";

import type { ReactNode } from "react";
import { cn, Label, Slider } from "@repo/ui";
import { NumberField } from "../editor/number-field";
import { InspectorHint } from "../editor/inspector-hint";

export interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Short unit shown inside the number box, e.g. "px", "%" or "s". */
  unit?: string;
  /** Explanation behind a "?" next to the label. */
  hint?: ReactNode;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
}

/**
 * A slider with the exact number beside it. Drag for a feel, type for a
 * value: both write through `onChange`, and the box refuses anything outside
 * the slider's range rather than clamping it behind your back.
 */
export function SliderField({
  id,
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  hint,
  disabled,
  className,
  onChange,
}: SliderFieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1">
          <Label id={`${id}-label`} className="truncate text-xs">
            {label}
          </Label>
          {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
        </div>
        <NumberField
          value={value}
          min={min}
          max={max}
          disabled={disabled}
          onCommit={onChange}
          aria-label={unit ? `${label} (${unit})` : label}
          className={cn(
            "h-7 w-16 px-2 text-xs tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            unit && "pr-6",
          )}
          adornment={
            unit ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
                {unit}
              </span>
            ) : undefined
          }
        />
      </div>
      <Slider
        id={id}
        aria-labelledby={`${id}-label`}
        value={[Math.min(max, Math.max(min, value))]}
        onValueChange={([v]) => onChange(v ?? value)}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
      />
    </div>
  );
}
