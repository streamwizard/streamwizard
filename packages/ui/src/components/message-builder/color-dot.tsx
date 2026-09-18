"use client";

import { useEffect, useState } from "react";
import { HexColorPicker } from "react-colorful";
import { normalizeHexColor } from "../ui/color-picker";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { fromHex, toHex } from "./discord-styles";

// StreamWizard purple first (docs/branding.md), then Discord's own role colours.
const SWATCHES = ["#9146ff", "#5865f2", "#57f287", "#fee75c", "#eb459e", "#ed4245", "#e67e22", "#1abc9c", "#3498db", "#95a5a6", "#ffffff", "#23272a"];

export function ColorDot({ color, onChange, disabled }: { color: number; onChange: (color: number) => void; disabled?: boolean }) {
  const hex = toHex(color);
  const [draft, setDraft] = useState(hex);
  useEffect(() => setDraft(hex), [hex]);

  const commit = (raw: string) => {
    const next = normalizeHexColor(raw, hex);
    setDraft(next);
    if (next !== hex) onChange(fromHex(next));
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label={`Embed color, ${hex}`}
          title="Embed color"
          className="size-7 shrink-0 rounded-full border-2 border-black/40 shadow-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-[#5865f2] disabled:opacity-40"
          style={{ backgroundColor: hex }}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-3 p-3">
        <HexColorPicker color={hex} onChange={(next) => onChange(fromHex(next))} style={{ width: "100%", height: 140 }} />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && commit(e.currentTarget.value)}
          spellCheck={false}
          aria-label="Hex color"
          className="h-8 font-mono text-xs uppercase"
        />
        <div className="grid grid-cols-6 gap-1.5">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              aria-label={swatch}
              onClick={() => onChange(fromHex(swatch))}
              className="size-6 rounded-full border border-border/60 transition-transform hover:scale-110"
              style={{ backgroundColor: swatch }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
