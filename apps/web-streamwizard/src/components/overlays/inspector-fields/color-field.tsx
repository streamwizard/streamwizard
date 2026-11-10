"use client";

import { ColorPicker, Label } from "@repo/ui";

/** A labelled colour swatch with its picker. */
export function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <ColorPicker value={value} onChange={onChange} aria-label={`${label} color`} />
    </div>
  );
}
