"use client";

import { Plus } from "lucide-react";
import type { PresetSkeleton } from "@repo/discord-message";
import { Badge } from "../ui/badge";
import { cn } from "../../lib/utils";
import type { BuilderPreset } from "./types";

const bar = "h-1.5 rounded-full bg-current";

/** A miniature of what the preset adds. Decorative. */
function Skeleton({ kind }: { kind: PresetSkeleton }) {
  if (kind === "banner") {
    return (
      <div className="flex h-10 items-center justify-center rounded-md bg-gradient-to-r from-[#5b21b6] to-[#9146ff]">
        <div className={cn(bar, "w-1/3 text-white/80")} />
      </div>
    );
  }
  if (kind === "buttons") {
    return (
      <div className="flex h-10 items-center gap-1.5 rounded-md bg-muted px-2">
        <div className="flex h-4 w-2/5 items-center justify-center rounded bg-[#5865f2]">
          <div className={cn(bar, "w-1/2 text-white/80")} />
        </div>
        <div className="flex h-4 w-1/3 items-center justify-center rounded bg-[#4e5058]">
          <div className={cn(bar, "w-1/2 text-white/70")} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-10 flex-col justify-center gap-1 rounded-[3px] border-l-[3px] border-[#9146ff] bg-muted px-2 text-muted-foreground/50">
      {kind === "embed" && (
        <>
          <div className={cn(bar, "w-2/5 text-muted-foreground")} />
          <div className={cn(bar, "w-full")} />
          <div className={cn(bar, "w-3/4")} />
        </>
      )}
      {kind === "list" &&
        [0, 1, 2].map((i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="size-1.5 rounded-full bg-[#9146ff]" />
            <div className={cn(bar, i === 1 ? "w-1/2" : "w-3/4")} />
          </div>
        ))}
      {kind === "columns" && (
        <div className="grid grid-cols-2 gap-2">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-1">
              <div className={cn(bar, "w-1/2 text-muted-foreground")} />
              <div className={cn(bar, "w-full")} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface PresetMenuProps {
  presets: BuilderPreset[];
  onAdd: (preset: BuilderPreset) => void;
  onLockedClick?: (preset: BuilderPreset) => void;
}

export function PresetMenu({ presets, onAdd, onLockedClick }: PresetMenuProps) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {presets.map((preset) => (
        <li key={preset.id}>
          <button
            type="button"
            aria-disabled={Boolean(preset.locked) && !onLockedClick}
            onClick={() => (preset.locked ? onLockedClick?.(preset) : onAdd(preset))}
            className={cn(
              "group/preset flex h-full w-full flex-col gap-2 rounded-lg border bg-card p-2.5 text-left transition-colors",
              "hover:border-primary/60 focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
              preset.locked && "opacity-70",
            )}
          >
            <Skeleton kind={preset.skeleton} />
            <span className="flex items-start justify-between gap-2">
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium">
                  {preset.label}
                  {preset.locked && <Badge variant="secondary">{preset.locked}</Badge>}
                </span>
                <span className="block text-xs text-muted-foreground">{preset.description}</span>
              </span>
              {!preset.locked && (
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover/preset:bg-primary group-hover/preset:text-primary-foreground">
                  <Plus className="size-3.5" />
                </span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
