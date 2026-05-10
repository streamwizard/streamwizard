"use client";

import { Label } from "@repo/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { cn } from "@/lib/utils";

export type OverlayFontWeight = 400 | 500 | 600 | 700;

const WEIGHT_OPTIONS: { value: OverlayFontWeight; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];

export interface FontWeightSelectProps {
  value: OverlayFontWeight;
  onValueChange: (value: OverlayFontWeight) => void;
  /** Default “Weight”. Pass `""` to omit the label. */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
}

export function FontWeightSelect({
  value,
  onValueChange,
  label,
  id,
  disabled,
  className,
  labelClassName,
  triggerClassName,
}: FontWeightSelectProps) {
  const labelText = label === undefined ? "Weight" : label;
  const showLabel = labelText.length > 0;

  const select = (
    <Select
      value={String(value)}
      onValueChange={(v) => onValueChange(Number(v) as OverlayFontWeight)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn("h-9 text-xs", triggerClassName)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {WEIGHT_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={String(opt.value)}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (!showLabel) {
    return <div className={className}>{select}</div>;
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id} className={cn("text-xs", labelClassName)}>
        {labelText}
      </Label>
      {select}
    </div>
  );
}
