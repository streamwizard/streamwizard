"use client";

import { useMemo } from "react";
import {
  Button,
  ColorPicker,
  Input,
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
  presetGeometry,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import {
  LABEL_CATALOG,
  LABEL_GROUP_TITLES,
  LABEL_PERIODS,
  LABEL_PERIOD_LABELS,
  getLabelDefinition,
  type LabelDefinition,
  type LabelGroup,
  type LabelPeriod,
} from "@repo/schemas";
import {
  LABELS_RESET_BROWSER_EVENT,
  LABEL_ANIMATE_PREVIEW_EVENT,
  LABEL_WIDGET_ANIMATIONS,
  LABEL_WIDGET_ANIMATION_LABELS,
  LABEL_WIDGET_LIMITS,
  normalizeLabelWidgetConfig,
  type LabelAnimatePreviewDetail,
  type LabelWidgetAnimation,
  type LabelWidgetDirection,
  type LabelWidgetItemConfig,
  type LabelWidgetLayout,
  type LabelsResetBrowserEventDetail,
} from "@repo/ui/overlay";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const LAYOUT_OPTIONS: readonly SegmentedOption<LabelWidgetLayout>[] = [
  { value: "inline", label: "One line" },
  { value: "stacked", label: "Prefix above" },
];

const DIRECTION_OPTIONS: readonly SegmentedOption<LabelWidgetDirection>[] = [
  { value: "vertical", label: "Stacked" },
  { value: "horizontal", label: "In a row" },
];

/** Only groups the catalog uses, in catalog order. */
const GROUPS = [...new Set(LABEL_CATALOG.map((d) => d.group))] as LabelGroup[];

/** Canvas size per kind of label, applied when switching between kinds. */
const SIZES = {
  single: { w: 480, h: 64 },
  stacked: { w: 360, h: 260 },
  row: { w: 960, h: 64 },
} as const;

function isList(def: LabelDefinition): boolean {
  return def.shape === "list" || (def.shape === "leaders" && !def.single);
}

function sizeFor(def: LabelDefinition, direction: LabelWidgetDirection) {
  if (!isList(def)) return SIZES.single;
  return direction === "vertical" ? SIZES.stacked : SIZES.row;
}

/** The {tokens} a label can fill, for the chips under the template. */
function tokensFor(def: LabelDefinition): string[] {
  if (def.shape === "number") return ["amount"];
  if (def.shape === "leaders") return ["name", "amount"];
  const base = ["name", "amount"];
  if (def.group === "subscribers") base.push("tier", "months", "message");
  if (def.group === "bits") base.push("message");
  if (def.group === "channel_points") base.push("reward", "message");
  if (def.id === "event_list") return ["event", ...base];
  return base;
}

export function LabelWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = useMemo(() => normalizeLabelWidgetConfig(item.config), [item.config]);
  const def = getLabelDefinition(cfg.labelId);
  const sceneId = useOverlayStore((s) => s.scene?.id);
  const list = isList(def);

  function patchConfig(updates: Partial<LabelWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchWithSize(updates: Partial<LabelWidgetItemConfig>, nextDef: LabelDefinition) {
    const next = { ...cfg, ...updates };
    const from = sizeFor(def, cfg.direction);
    const to = sizeFor(nextDef, next.direction);
    const geometry = from === to ? null : presetGeometry(item, to);
    updateItem(item.id, { config: next, ...geometry });
  }

  function pickLabel(labelId: string) {
    const nextDef = getLabelDefinition(labelId);
    // A prefix still matching the old label's name follows the switch; a
    // hand-written one stays. The template goes back to the new label's own.
    const prefix = cfg.prefix.trim() === "" || cfg.prefix.trim() === def.title ? nextDef.title : cfg.prefix;
    patchWithSize({ labelId, template: "", prefix, period: nextDef.defaultPeriod ?? "all" }, nextDef);
  }

  function insertToken(token: string) {
    const current = cfg.template || def.template;
    patchConfig({ template: `${current}{${token}}`.slice(0, LABEL_WIDGET_LIMITS.template) });
  }

  function previewAnimation() {
    window.dispatchEvent(
      new CustomEvent<LabelAnimatePreviewDetail>(LABEL_ANIMATE_PREVIEW_EVENT, { detail: { itemId: item.id } }),
    );
  }

  function resetTests() {
    if (!sceneId) return;
    window.dispatchEvent(
      new CustomEvent<LabelsResetBrowserEventDetail>(LABELS_RESET_BROWSER_EVENT, { detail: { sceneId } }),
    );
  }

  return (
    <div className="space-y-6">
      <InspectorSection title="Content" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="label-widget-label" className="text-xs">
              Show
            </Label>
            <Select value={cfg.labelId} onValueChange={pickLabel}>
              <SelectTrigger id="label-widget-label" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUPS.map((group, i) => (
                  <SelectGroup key={group}>
                    {i > 0 && <SelectSeparator className="my-1.5" />}
                    <SelectLabel className="pt-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/70">
                      {LABEL_GROUP_TITLES[group]}
                    </SelectLabel>
                    {LABEL_CATALOG.filter((d) => d.group === group).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.title}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>


          <InspectorReveal show={!!def.defaultPeriod} marginTop={0}>
            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label htmlFor="label-widget-period" className="text-xs">
                  Time range
                </Label>
                <InspectorHint label="About the time range">
                  Only counts what happened in this range. Days, weeks and months follow UTC, weeks start on Monday.
                  All time starts when StreamWizard started tracking your channel.
                </InspectorHint>
              </div>
              <Select value={cfg.period} onValueChange={(v) => patchConfig({ period: v as LabelPeriod })}>
                <SelectTrigger id="label-widget-period" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LABEL_PERIODS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {LABEL_PERIOD_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </InspectorReveal>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="label-widget-prefix" className="text-xs">
                Prefix
              </Label>
              <InspectorHint label="About the prefix">
                The words before the value. Leave it empty to show the value on its own.
              </InspectorHint>
            </div>
            <Input
              id="label-widget-prefix"
              value={cfg.prefix}
              onChange={(e) => patchConfig({ prefix: e.target.value })}
              className="h-9 text-sm"
              placeholder={def.title}
              maxLength={LABEL_WIDGET_LIMITS.prefix}
            />
          </div>
          <InspectorReveal show={cfg.prefix.trim() !== "" && !list} marginTop={0}>
            <SegmentedField
              id="label-widget-layout"
              label="Layout"
              value={cfg.layout}
              options={LAYOUT_OPTIONS}
              onChange={(layout) => patchConfig({ layout })}
            />
          </InspectorReveal>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="label-widget-template" className="text-xs">
                Text
              </Label>
              <InspectorHint label="About the text">
                What each entry says. Words in braces get filled in, so {"{name} - {amount}"} becomes
                &quot;MoonPie - 500&quot;. Leave it empty for the default.
              </InspectorHint>
            </div>
            <Input
              id="label-widget-template"
              value={cfg.template}
              onChange={(e) => patchConfig({ template: e.target.value })}
              className="h-9 font-mono text-sm"
              placeholder={def.template}
              maxLength={LABEL_WIDGET_LIMITS.template}
            />
            <div className="flex flex-wrap gap-1">
              {tokensFor(def).map((token) => (
                <Button
                  key={token}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 font-mono text-[11px]"
                  onClick={() => insertToken(token)}
                >
                  {`{${token}}`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="label-widget-empty" className="text-xs">
                When there&apos;s nothing yet
              </Label>
              <InspectorHint label="About the empty text">
                Shown before the first follow, cheer or raid lands. Leave it empty and the label stays hidden until then.
              </InspectorHint>
            </div>
            <Input
              id="label-widget-empty"
              value={cfg.emptyText}
              onChange={(e) => patchConfig({ emptyText: e.target.value })}
              className="h-9 text-sm"
              placeholder="Hidden"
              maxLength={LABEL_WIDGET_LIMITS.emptyText}
            />
          </div>
        </div>
      </InspectorSection>

      {list && (
        <InspectorSection title="List" defaultOpen>
          <div className="space-y-4">
            <SliderField
              id="label-widget-count"
              label="Entries"
              value={cfg.count}
              min={LABEL_WIDGET_LIMITS.count.min}
              max={LABEL_WIDGET_LIMITS.count.max}
              onChange={(count) => patchConfig({ count })}
            />
            <SegmentedField
              id="label-widget-direction"
              label="Direction"
              value={cfg.direction}
              options={DIRECTION_OPTIONS}
              onChange={(direction) => patchWithSize({ direction }, def)}
            />
            <InspectorReveal show={cfg.direction === "horizontal"} marginTop={0}>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="label-widget-separator" className="text-xs">
                    Separator
                  </Label>
                  <Input
                    id="label-widget-separator"
                    value={cfg.separator}
                    onChange={(e) => patchConfig({ separator: e.target.value })}
                    className="h-9 text-sm"
                    maxLength={LABEL_WIDGET_LIMITS.separator}
                  />
                </div>
                <SwitchField
                  id="label-widget-marquee"
                  label="Scroll like a ticker"
                  checked={cfg.marquee}
                  onCheckedChange={(marquee) => patchConfig({ marquee })}
                />
                <InspectorReveal show={cfg.marquee} marginTop={0}>
                  <SliderField
                    id="label-widget-marquee-speed"
                    label="Speed"
                    unit="px/s"
                    value={cfg.marqueeSpeed}
                    min={LABEL_WIDGET_LIMITS.marqueeSpeed.min}
                    max={LABEL_WIDGET_LIMITS.marqueeSpeed.max}
                    onChange={(marqueeSpeed) => patchConfig({ marqueeSpeed })}
                  />
                </InspectorReveal>
              </div>
            </InspectorReveal>
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Text style">
        <div className="space-y-4">
          <GoogleFontSelect
            id="label-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <SliderField
            id="label-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={LABEL_WIDGET_LIMITS.fontSize.min}
            max={LABEL_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Color</Label>
              <ColorPicker value={cfg.color} onChange={(color) => patchConfig({ color })} aria-label="Text color" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Prefix color</Label>
              <ColorPicker
                value={cfg.prefixColor}
                onChange={(prefixColor) => patchConfig({ prefixColor })}
                aria-label="Prefix color"
              />
            </div>
          </div>
          <FontWeightSelect
            id="label-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <TextAlignSelect
            id="label-widget-align"
            triggerClassName="w-full"
            value={cfg.align}
            onValueChange={(align) => patchConfig({ align })}
          />
          <div className="space-y-1">
            <SwitchField
              id="label-widget-shadow"
              label="Text shadow"
              checked={cfg.textShadow}
              onCheckedChange={(textShadow) => patchConfig({ textShadow })}
            />
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Animation" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label htmlFor="label-widget-animation" className="text-xs">
                New value comes in with
              </Label>
              <InspectorHint label="About the animation">
                Plays when a new follower, sub or cheer lands. Lists animate their newest entry. Reloading the overlay
                doesn&apos;t replay it.
              </InspectorHint>
            </div>
            <Select value={cfg.animation} onValueChange={(v) => patchConfig({ animation: v as LabelWidgetAnimation })}>
              <SelectTrigger id="label-widget-animation" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LABEL_WIDGET_ANIMATIONS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {LABEL_WIDGET_ANIMATION_LABELS[a]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <InspectorReveal show={cfg.animation !== "none"} marginTop={0}>
            <div className="space-y-3">
              <SliderField
                id="label-widget-animation-duration"
                label="Length"
                unit="ms"
                step={50}
                value={cfg.animationDuration}
                min={LABEL_WIDGET_LIMITS.animationDuration.min}
                max={LABEL_WIDGET_LIMITS.animationDuration.max}
                onChange={(animationDuration) => patchConfig({ animationDuration })}
              />
              <Button type="button" variant="outline" size="sm" className="w-full" onClick={previewAnimation}>
                Preview
              </Button>
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Testing">
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Test events from the demo bar show up here without being saved. Empty labels show sample data in the
            editor only.
          </p>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={resetTests} disabled={!sceneId}>
            Clear test events
          </Button>
        </div>
      </InspectorSection>
    </div>
  );
}
