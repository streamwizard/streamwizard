"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type TextAlignOption = "left" | "center" | "right";

const ALIGN_OPTIONS: { value: TextAlignOption; label: string }[] = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

export interface TextAlignSelectProps {
  value: TextAlignOption;
  onValueChange: (value: TextAlignOption) => void;
  /** Default “Alignment”. Pass `""` to omit the label. */
  label?: string;
  id?: string;
  disabled?: boolean;
  className?: string;
  labelClassName?: string;
  triggerClassName?: string;
}

export function TextAlignSelect({
  value,
  onValueChange,
  label,
  id,
  disabled,
  className,
  labelClassName,
  triggerClassName,
}: TextAlignSelectProps) {
  const labelText = label === undefined ? "Alignment" : label;
  const showLabel = labelText.length > 0;

  const select = (
    <Select
      value={value}
      onValueChange={(v) => onValueChange(v as TextAlignOption)}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        className={cn("h-9 text-xs", triggerClassName)}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ALIGN_OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
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
