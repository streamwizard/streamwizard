"use client";

import { useMemo } from "react";
import { ColorPicker, Input, Label } from "@repo/ui";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  TextAlignSelect,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import {
  UPTIME_WIDGET_LIMITS,
  normalizeUptimeWidgetConfig,
  type UptimeWidgetItemConfig,
  type UptimeWidgetLayout,
} from "@repo/ui/overlay";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const LAYOUT_OPTIONS: readonly SegmentedOption<UptimeWidgetLayout>[] = [
  { value: "inline", label: "One line" },
  { value: "stacked", label: "Label above" },
];

export function UptimeWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = useMemo(() => normalizeUptimeWidgetConfig(item.config), [item.config]);

  function patchConfig(updates: Partial<UptimeWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  return (
    <div className="space-y-6">
      <InspectorSection title="Content" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="uptime-widget-label" className="text-xs">
                Label
              </Label>
              <InspectorHint label="About the label">
                The words before the time. Leave it empty to show the time on its own.
              </InspectorHint>
            </div>
            <Input
              id="uptime-widget-label"
              value={cfg.label}
              onChange={(e) => patchConfig({ label: e.target.value })}
              className="h-9 text-sm"
              placeholder="Live for"
              maxLength={UPTIME_WIDGET_LIMITS.label}
            />
          </div>
          <InspectorReveal show={cfg.label.trim() !== ""} marginTop={0}>
            <SegmentedField
              id="uptime-widget-layout"
              label="Layout"
              value={cfg.layout}
              options={LAYOUT_OPTIONS}
              onChange={(layout) => patchConfig({ layout })}
            />
          </InspectorReveal>
          <div className="space-y-1">
            <SwitchField
              id="uptime-widget-seconds"
              label="Seconds"
              checked={cfg.showSeconds}
              onCheckedChange={(showSeconds) => patchConfig({ showSeconds })}
            />
            <SwitchField
              id="uptime-widget-dot"
              label="Live dot"
              hint="A pulsing dot before the label, like a live badge."
              checked={cfg.showDot}
              onCheckedChange={(showDot) => patchConfig({ showDot })}
            />
          </div>
          <InspectorReveal show={cfg.showDot} marginTop={0}>
            <div className="space-y-1.5">
              <Label className="text-xs">Dot color</Label>
              <ColorPicker value={cfg.dotColor} onChange={(dotColor) => patchConfig({ dotColor })} aria-label="Dot color" />
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Offline" defaultOpen>
        <div className="space-y-4">
          <SwitchField
            id="uptime-widget-hide-offline"
            label="Hide when offline"
            hint="On stream the widget shows how long you have been live. Off stream it shows nothing, or the line below."
            checked={cfg.hideWhenOffline}
            onCheckedChange={(hideWhenOffline) => patchConfig({ hideWhenOffline })}
          />
          <InspectorReveal show={!cfg.hideWhenOffline} marginTop={0}>
            <div className="space-y-1.5">
              <Label htmlFor="uptime-widget-offline-text" className="text-xs">
                Offline text
              </Label>
              <Input
                id="uptime-widget-offline-text"
                value={cfg.offlineText}
                onChange={(e) => patchConfig({ offlineText: e.target.value })}
                className="h-9 text-sm"
                placeholder="Offline"
                maxLength={UPTIME_WIDGET_LIMITS.offlineText}
              />
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Text">
        <div className="space-y-4">
          <GoogleFontSelect
            id="uptime-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <SliderField
            id="uptime-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={UPTIME_WIDGET_LIMITS.fontSize.min}
            max={UPTIME_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Color</Label>
              <ColorPicker value={cfg.color} onChange={(color) => patchConfig({ color })} aria-label="Text color" />
            </div>
            <FontWeightSelect
              id="uptime-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(fontWeight) => patchConfig({ fontWeight })}
            />
          </div>
          <TextAlignSelect
            id="uptime-widget-align"
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(align) => patchConfig({ align })}
          />
          <SwitchField
            id="uptime-widget-shadow"
            label="Text shadow"
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
        </div>
      </InspectorSection>
    </div>
  );
}
