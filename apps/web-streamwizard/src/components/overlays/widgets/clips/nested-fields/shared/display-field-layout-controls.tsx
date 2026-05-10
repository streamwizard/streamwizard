"use client";

import { Button } from "@repo/ui";
import { Input } from "@repo/ui";
import { Label } from "@repo/ui";
import { Slider } from "@repo/ui";
import type { ClipDisplayFieldLayout } from "@/types/overlays";

export interface DisplayFieldLayoutControlsProps {
  label: string;
  layout: ClipDisplayFieldLayout;
  layoutLocked?: boolean;
  onUpdateLayout: (patch: Partial<ClipDisplayFieldLayout>) => void;
  onResetLayout: () => void;
}

/** Shared X/Y/W/H/font + reset — reuse in custom nested field inspectors. */
export function DisplayFieldLayoutControls({
  label,
  layout,
  layoutLocked = false,
  onUpdateLayout,
  onResetLayout,
}: DisplayFieldLayoutControlsProps) {
  return (
    <fieldset
      disabled={layoutLocked}
      className="space-y-5 border-0 p-0 m-0 min-w-0 disabled:opacity-60"
    >
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">X (%)</Label>
          <Input
            type="number"
            value={layout.x}
            onChange={(e) =>
              onUpdateLayout({
                x: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              })
            }
            className="h-8 text-sm"
            step={0.5}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Y (%)</Label>
          <Input
            type="number"
            value={layout.y}
            onChange={(e) =>
              onUpdateLayout({
                y: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
              })
            }
            className="h-8 text-sm"
            step={0.5}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <Label className="text-xs">Width (%)</Label>
          <Input
            type="number"
            value={layout.w}
            onChange={(e) =>
              onUpdateLayout({
                w: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
              })
            }
            className="h-8 text-sm"
            step={0.5}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Height (%)</Label>
          <Input
            type="number"
            value={layout.h}
            onChange={(e) =>
              onUpdateLayout({
                h: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
              })
            }
            className="h-8 text-sm"
            step={0.5}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Font size ({layout.fontSize}px)</Label>
        <Slider
          value={[layout.fontSize]}
          onValueChange={([val]) =>
            onUpdateLayout({ fontSize: Math.max(8, Math.min(48, val)) })
          }
          min={8}
          max={48}
          step={1}
          className="py-1"
        />
      </div>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        type="button"
        onClick={onResetLayout}
      >
        Reset {label.toLowerCase()} to defaults
      </Button>
    </fieldset>
  );
}
