"use client";

import { useState, type ReactNode } from "react";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  Switch,
  cn,
} from "@repo/ui";
import { Check, ChevronRight, Minus, Plus } from "lucide-react";

// Touch primitives for the deck's switcher tab. Everything here is sized for a
// thumb: rows are >=56px, steppers replace number keyboards, and value pickers
// open a bottom drawer instead of a cramped popover select.

export function SettingSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <div className="px-1">
        <h2 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border overflow-hidden rounded-2xl border bg-card">{children}</div>
    </section>
  );
}

/** Label + description on the left, whatever control you pass on the right. */
export function SettingRow({
  label,
  description,
  error,
  children,
  className,
}: {
  label: ReactNode;
  description?: ReactNode;
  error?: string | null;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("min-h-14 px-4 py-3", className)}>
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{label}</p>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
      {error ? <p className="mt-1.5 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <SettingRow label={label} description={description}>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label} />
    </SettingRow>
  );
}

/** Full-width tappable row that shows the current value and opens a picker. */
export function PickerRow({
  label,
  description,
  value,
  placeholder,
  error,
  disabled,
  onOpen,
}: {
  label: string;
  description?: string;
  value: string | null;
  placeholder: string;
  error?: string | null;
  disabled?: boolean;
  onOpen: () => void;
}) {
  return (
    <div className="px-1 py-1">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        className={cn(
          "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors",
          "active:bg-accent disabled:opacity-50",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{label}</span>
          {description ? <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span> : null}
        </span>
        <span className="flex min-w-0 shrink items-center gap-1">
          <span className={cn("truncate text-sm", value ? "text-foreground" : "text-muted-foreground")}>{value ?? placeholder}</span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
      </button>
      {error ? <p className="px-3 pb-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

export interface PickerOption {
  value: string;
  label: string;
}

/** Bottom drawer list picker. Long scene names get a full row instead of being truncated in a popover. */
export function PickerDrawer({
  open,
  onOpenChange,
  title,
  description,
  options,
  selected,
  emptyLabel,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  description?: string;
  options: PickerOption[];
  selected: string | null;
  emptyLabel: string;
  onSelect: (value: string) => void;
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="pb-[env(safe-area-inset-bottom)]">
        <DrawerHeader>
          <DrawerTitle>{title}</DrawerTitle>
          {description ? <DrawerDescription>{description}</DrawerDescription> : null}
        </DrawerHeader>
        <div className="max-h-[55vh] overflow-y-auto px-2 pb-4">
          {options.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
          ) : (
            options.map((option) => {
              const isSelected = option.value === selected;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSelect(option.value);
                    onOpenChange(false);
                  }}
                  className={cn(
                    "flex min-h-14 w-full items-center justify-between gap-3 rounded-xl px-3 text-left transition-colors active:bg-accent",
                    isSelected && "bg-accent/50",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{option.label}</span>
                  {isSelected ? <Check className="h-4 w-4 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Numeric setting with +/- buttons. The readout stays typable for big jumps. */
export function StepperRow({
  label,
  description,
  unit,
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
}: {
  label: string;
  description?: string;
  unit?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.min(max, Math.max(min, next));
  return (
    <SettingRow label={label} description={description}>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={disabled || value <= min}
          onClick={() => onChange(clamp(value - step))}
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          disabled={disabled}
          onChange={(event) => {
            const parsed = Number(event.target.value.replace(/[^0-9]/g, ""));
            if (Number.isFinite(parsed)) onChange(parsed);
          }}
          onBlur={() => onChange(clamp(value))}
          aria-label={unit ? `${label} in ${unit}` : label}
          className="h-11 w-16 rounded-xl border bg-background text-center text-sm tabular-nums outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-11 w-11 rounded-xl"
          disabled={disabled || value >= max}
          onClick={() => onChange(clamp(value + step))}
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </SettingRow>
  );
}

/** Full-width choice cards, one per row. Replaces the desktop's side-by-side radio columns. */
export function ChoiceCards<T extends string>({
  value,
  options,
  disabled,
  onChange,
}: {
  value: T;
  options: { value: T; title: string; blurb: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors active:bg-accent disabled:opacity-50",
              isSelected && "border-primary bg-primary/5",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{option.title}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">{option.blurb}</span>
            </span>
            {isSelected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> : null}
          </button>
        );
      })}
    </div>
  );
}

/** Two-up segmented control for short binary choices. */
export function SegmentedRow<T extends string>({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  disabled?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <div className="space-y-2 p-3">
      <p className="px-1 text-sm font-medium">{label}</p>
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-14 rounded-xl border px-3 py-2 text-center transition-colors active:bg-accent disabled:opacity-50",
                isSelected && "border-primary bg-primary/5",
              )}
            >
              <span className="block text-sm font-medium">{option.label}</span>
              {option.hint ? <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{option.hint}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Small helper so a PickerRow + PickerDrawer pair is a single call site. */
export function usePickerState() {
  const [openPicker, setOpenPicker] = useState<string | null>(null);
  return {
    openPicker,
    open: (key: string) => setOpenPicker(key),
    close: () => setOpenPicker(null),
    isOpen: (key: string) => openPicker === key,
    setOpen: (key: string) => (next: boolean) => setOpenPicker(next ? key : null),
  };
}
