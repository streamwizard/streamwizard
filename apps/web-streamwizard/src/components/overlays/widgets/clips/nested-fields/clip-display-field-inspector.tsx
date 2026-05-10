"use client";

import type { ClipDisplayFieldLayout, DisplayFieldKey } from "@/types/overlays";
import { getClipNestedFieldLabel } from "./registry";
import { DisplayFieldLayoutControls } from "./shared/display-field-layout-controls";

export interface ClipDisplayFieldInspectorProps {
  field: DisplayFieldKey;
  layout: ClipDisplayFieldLayout;
  layoutLocked?: boolean;
  onUpdateLayout: (patch: Partial<ClipDisplayFieldLayout>) => void;
  onResetLayout: () => void;
}

export function ClipDisplayFieldInspector({
  field,
  layout,
  layoutLocked = false,
  onUpdateLayout,
  onResetLayout,
}: ClipDisplayFieldInspectorProps) {
  const label = getClipNestedFieldLabel(field);

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
          Display field
        </h3>
        <p className="text-sm font-medium">{label}</p>
        {layoutLocked ? (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1.5">
            This field is locked. Unlock it from the layer row to edit layout
            here or on the canvas.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground mt-1">
            Position and size are percentages of the clip widget box. You can
            also drag and resize on the canvas.
          </p>
        )}
      </div>

      <DisplayFieldLayoutControls
        label={label}
        layout={layout}
        layoutLocked={layoutLocked}
        onUpdateLayout={onUpdateLayout}
        onResetLayout={onResetLayout}
      />
    </div>
  );
}
