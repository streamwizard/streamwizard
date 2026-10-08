"use client";

import { useEffect, useState } from "react";
import {
  cn,
  Label,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import { alertEffectKeyframes, alertEffectStyle, type AlertEffect } from "@repo/ui/overlay";
import { InspectorHint, NumberField } from "@/components/overlays/inspector-fields";
import { alertEffectLabel, groupAlertEffects } from "./alert-widget-labels";

/** What an effect gets when it is picked while its time is still 0: with no time it would not show at all. */
const STARTING_SECONDS = 0.5;
/** How long a preview rests on its last frame before going back to still. */
const PREVIEW_REST_MS = 450;

/**
 * A small tile that plays an effect on a block (or on letters, for the ones
 * that loop), so a name like "Rotate in down left" can be checked without
 * firing a test alert. It replays when the effect or its time changes, and on
 * a click.
 */
export function AlertEffectPreview({
  effect,
  seconds,
  loop = false,
}: {
  effect: AlertEffect | "none";
  seconds: number;
  loop?: boolean;
}) {
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(false);
  const durationMs = Math.max(0.2, seconds) * 1000;
  const motion = playing || loop ? alertEffectStyle(effect, durationMs, loop) : null;

  // Replay on change, but not on the first paint: a panel that opens with six
  // of these all moving at once is noise.
  const [seen, setSeen] = useState({ effect, seconds });
  if (seen.effect !== effect || seen.seconds !== seconds) {
    setSeen({ effect, seconds });
    setRun((n) => n + 1);
    setPlaying(true);
  }

  useEffect(() => {
    if (!playing || loop) return;
    const rest = setTimeout(() => setPlaying(false), durationMs + PREVIEW_REST_MS);
    return () => clearTimeout(rest);
  }, [playing, loop, run, durationMs]);

  return (
    <button
      type="button"
      disabled={effect === "none"}
      aria-label="Play this effect again"
      title={effect === "none" ? undefined : "Play it again"}
      onClick={() => {
        setRun((n) => n + 1);
        setPlaying(true);
      }}
      className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-md border border-input bg-background transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:hover:bg-background"
    >
      <style>{alertEffectKeyframes([effect])}</style>
      {loop ? (
        <span key={run} className="text-sm font-semibold text-primary" style={motion ?? undefined}>
          Aa
        </span>
      ) : (
        <span
          key={run}
          className={cn("size-3.5 rounded-sm", effect === "none" ? "bg-muted-foreground/30" : "bg-primary")}
          style={motion ?? undefined}
        />
      )}
    </button>
  );
}

export interface AlertEffectFieldProps<T extends AlertEffect | "none"> {
  id: string;
  label: string;
  hint?: string;
  /** Every effect on offer, `none` first. */
  effects: readonly T[];
  value: T;
  seconds: number;
  onChange: (updates: { effect: T; seconds: number }) => void;
}

/**
 * One enter or exit: which effect, and how long it takes. The effects come
 * grouped by family, since thirty-two of them in one flat list is a wall.
 */
export function AlertEffectField<T extends AlertEffect | "none">({
  id,
  label,
  hint,
  effects,
  value,
  seconds,
  onChange,
}: AlertEffectFieldProps<T>) {
  const off = value === "none";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label id={`${id}-label`} className="text-xs">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <div className="flex items-center gap-2">
        <AlertEffectPreview effect={value} seconds={seconds} />
        <Select
          value={value}
          onValueChange={(next) =>
            onChange({
              effect: next as T,
              // An effect with no time to play in would simply not show.
              seconds: next !== "none" && seconds === 0 ? STARTING_SECONDS : seconds,
            })
          }
        >
          <SelectTrigger aria-labelledby={`${id}-label`} className="h-9 min-w-0 flex-1 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            <SelectItem value="none" className="text-sm">
              {alertEffectLabel("none")}
            </SelectItem>
            {groupAlertEffects(effects).map((family) => (
              <SelectGroup key={family.label}>
                <SelectSeparator />
                <SelectLabel>{family.label}</SelectLabel>
                {family.effects.map((effect) => (
                  <SelectItem key={effect} value={effect} className="text-sm">
                    {alertEffectLabel(effect)}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>
        <NumberField
          value={seconds}
          min={0}
          max={10}
          disabled={off}
          aria-label={`${label} time in seconds`}
          className="h-9 w-16 px-2 pr-6 text-sm tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          adornment={
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">
              s
            </span>
          }
          onCommit={(next) => onChange({ effect: value, seconds: Math.round(next * 10) / 10 })}
        />
      </div>
    </div>
  );
}
