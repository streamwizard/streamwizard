"use client";

import { useMemo } from "react";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorReveal,
  InspectorSection,
  SliderField,
  SwitchField,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { ColorPicker, Label, Textarea } from "@repo/ui";
import { TEXT_WIDGET_LIMITS, normalizeTextWidgetConfig, type TextWidgetItemConfig } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

export function TextWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = useMemo(() => normalizeTextWidgetConfig(item.config), [item.config]);

  function patchConfig(updates: Partial<TextWidgetItemConfig>) {
    updateItem(item.id, {
      config: { ...cfg, ...updates },
    });
  }

  return (
    <div className="space-y-6">
      <InspectorSection title="Text" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="text-widget-content" className="text-xs">
              Content
            </Label>
            <Textarea
              id="text-widget-content"
              value={cfg.text}
              onChange={(e) => patchConfig({ text: e.target.value })}
              className="min-h-[88px] text-sm resize-y"
              maxLength={5000}
            />
          </div>

          <GoogleFontSelect
            id="text-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />

          <SliderField
            id="text-widget-font-size"
            label="Font size"
            unit="px"
            value={Math.round(cfg.fontSize)}
            min={8}
            max={200}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Color</Label>
              <ColorPicker value={cfg.color} onChange={(color) => patchConfig({ color })} aria-label="Text color" />
            </div>
            <FontWeightSelect
              id="text-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(fontWeight) => patchConfig({ fontWeight })}
            />
          </div>

          <InspectorReveal show={!cfg.scroll} marginTop={0}>
            <TextAlignSelect
              id="text-widget-align"
              triggerClassName="w-full"
              value={cfg.align}
              onValueChange={(align) => patchConfig({ align })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Outline and shadow">
        <div className="space-y-4">
          <SliderField
            id="text-widget-outline-width"
            label="Outline"
            unit="px"
            hint="A border around every letter. Keeps text readable on any background."
            value={cfg.outlineWidth}
            min={TEXT_WIDGET_LIMITS.outlineWidth.min}
            max={TEXT_WIDGET_LIMITS.outlineWidth.max}
            onChange={(outlineWidth) => patchConfig({ outlineWidth })}
          />
          <InspectorReveal show={cfg.outlineWidth > 0} marginTop={0}>
            <div className="space-y-1.5">
              <Label className="text-xs">Outline color</Label>
              <ColorPicker
                value={cfg.outlineColor}
                onChange={(outlineColor) => patchConfig({ outlineColor })}
                aria-label="Outline color"
              />
            </div>
          </InspectorReveal>
          <SwitchField
            id="text-widget-shadow"
            label="Text shadow"
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Background">
        <div className="space-y-4">
          <SliderField
            id="text-widget-background-opacity"
            label="Opacity"
            unit="%"
            hint="0% is no background. The box fills the whole widget, so drag an edge to give the text room."
            value={Math.round(cfg.backgroundOpacity * 100)}
            min={0}
            max={100}
            onChange={(opacity) => patchConfig({ backgroundOpacity: opacity / 100 })}
          />
          <InspectorReveal show={cfg.backgroundOpacity > 0} marginTop={0}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <ColorPicker
                  value={cfg.backgroundColor}
                  onChange={(backgroundColor) => patchConfig({ backgroundColor })}
                  aria-label="Background color"
                />
              </div>
              <SliderField
                id="text-widget-background-rounding"
                label="Rounded corners"
                unit="%"
                value={cfg.backgroundRounding}
                min={TEXT_WIDGET_LIMITS.backgroundRounding.min}
                max={TEXT_WIDGET_LIMITS.backgroundRounding.max}
                onChange={(backgroundRounding) => patchConfig({ backgroundRounding })}
              />
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Ticker">
        <div className="space-y-4">
          <SwitchField
            id="text-widget-scroll"
            label="Scroll the text"
            hint="Runs the text across the box on one line, over and over. Good for socials, sponsors and rules."
            checked={cfg.scroll}
            onCheckedChange={(scroll) => patchConfig({ scroll })}
          />
          <InspectorReveal show={cfg.scroll} marginTop={0}>
            <SliderField
              id="text-widget-scroll-speed"
              label="Speed"
              unit="px/s"
              value={cfg.scrollSpeed}
              min={TEXT_WIDGET_LIMITS.scrollSpeed.min}
              max={TEXT_WIDGET_LIMITS.scrollSpeed.max}
              onChange={(scrollSpeed) => patchConfig({ scrollSpeed })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>
    </div>
  );
}
