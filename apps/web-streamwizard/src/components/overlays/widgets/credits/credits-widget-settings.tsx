"use client";

import { useCallback, useEffect, useState } from "react";
import { env } from "@/lib/env";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { Loader2, Play, RefreshCw, Sparkles, Square } from "lucide-react";
import { buildDemoCreditsData, type CreditsData } from "@repo/schemas";
import { Button, cn, ColorPicker, Input, Label, Switch, Textarea, ToggleGroup, ToggleGroupItem } from "@repo/ui";
import { SortableList } from "@repo/ui/components/sortable-list";
import {
  CREDITS_RESET_BROWSER_EVENT,
  CREDITS_ROLL_BROWSER_EVENT,
  CREDITS_SECTION_NAMES,
  CREDITS_WIDGET_LIMITS,
  CREDITS_WIDGET_PRESET_LABELS,
  CREDITS_WIDGET_PRESET_SIZES,
  CREDITS_WIDGET_PRESETS,
  creditsPresetChange,
  creditsSectionHasLabel,
  formatCreditsDuration,
  formatCreditsNumber,
  isCreditsScrollPreset,
  normalizeCreditsWidgetConfig,
  streamChangedFromFrame,
  subscribeToWsRoom,
  type CreditsResetBrowserEventDetail,
  type CreditsRollBrowserEventDetail,
  type CreditsSection,
  type CreditsWidgetFrame,
  type CreditsWidgetItemConfig,
  type CreditsWidgetPreset,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  presetGeometry,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const LOOP_OPTIONS: readonly SegmentedOption<"once" | "loop">[] = [
  { value: "once", label: "Play once" },
  { value: "loop", label: "Loop" },
];

/** A tiny drawing of each design, so the grid reads before the labels do. */
function PresetSketch({ preset }: { preset: CreditsWidgetPreset }) {
  const ink = "bg-muted-foreground/70";
  const accent = "bg-primary/80";
  switch (preset) {
    case "classic":
      return (
        <div className="flex w-full flex-col items-center gap-1">
          <div className={cn("h-1 w-5 rounded-full", accent)} />
          <div className={cn("h-1 w-8 rounded-full", ink)} />
          <div className={cn("h-1 w-7 rounded-full", ink)} />
          <div className={cn("h-1 w-4 rounded-full", accent)} />
          <div className={cn("h-1 w-6 rounded-full", ink)} />
        </div>
      );
    case "cards":
      return (
        <div className="w-full rounded-md border-l-2 border-primary/80 bg-muted-foreground/20 p-1.5">
          <div className={cn("mb-1 h-1 w-5 rounded-full", accent)} />
          <div className={cn("h-1 w-full rounded-full", ink)} />
        </div>
      );
    case "ticker":
      return (
        <div className="flex w-full items-center gap-1 overflow-hidden">
          <div className={cn("h-1 w-4 shrink-0 rounded-full", accent)} />
          <div className={cn("h-1 w-16 shrink-0 rounded-full", ink)} />
          <div className={cn("h-1 w-4 shrink-0 rounded-full", accent)} />
        </div>
      );
    case "arcade":
      return (
        <div className="w-full border-2 border-primary/70 p-1">
          <div className={cn("mb-0.5 h-1 w-5", accent)} />
          <div className={cn("h-1 w-7", ink)} />
          <div className={cn("mt-0.5 h-1 w-6", ink)} />
        </div>
      );
    case "minimal":
      return (
        <div className="flex w-full flex-col items-start gap-1">
          <div className="h-0.5 w-4 rounded-full bg-muted-foreground/50" />
          <div className={cn("h-1 w-7 rounded-full", ink)} />
          <div className={cn("h-1 w-5 rounded-full", ink)} />
        </div>
      );
    case "cinematic":
      return (
        <div className="flex w-full flex-col">
          <div className="h-1.5 w-full bg-foreground/80" />
          <div className="flex h-5 items-center justify-center">
            <div className={cn("h-1.5 w-8 rounded-full", ink)} />
          </div>
          <div className="h-1.5 w-full bg-foreground/80" />
        </div>
      );
  }
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <ColorPicker value={value} onChange={onChange} aria-label={`${label} color`} />
    </div>
  );
}

type SourceResponse = { status: "loading" } | { status: "failed" } | { status: "ready"; data: CreditsData };

/**
 * The stream the widget would roll right now, for the status line: read once
 * through the dashboard session, read again when the stream starts or ends
 * (the same socket frames the canvas widget watches) or on Refresh.
 */
function useCreditsSource() {
  const [response, setResponse] = useState<SourceResponse>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);
  const token = useOverlayStore((s) => s.scene?.subscriber_token);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twitch/assets/credits");
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as CreditsData;
        if (!cancelled) setResponse({ status: "ready", data });
      } catch {
        if (!cancelled) setResponse({ status: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    const wsUrl = env.NEXT_PUBLIC_WS_SERVER_URL;
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      if (streamChangedFromFrame(raw as CreditsWidgetFrame)) refresh();
    });
  }, [token, refresh]);

  return { response, refresh };
}

const dateFormat = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

function summary(data: CreditsData): string {
  const c = data.counts;
  const parts = [
    `${formatCreditsNumber(c.followers)} ${c.followers === 1 ? "follower" : "followers"}`,
    `${formatCreditsNumber(c.subs + c.resubs)} ${c.subs + c.resubs === 1 ? "sub" : "subs"}`,
    `${formatCreditsNumber(c.raids)} ${c.raids === 1 ? "raid" : "raids"}`,
  ];
  return parts.join(", ");
}

export function CreditsWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeCreditsWidgetConfig(item.config);
  const sceneId = useOverlayStore((s) => s.scene?.id);
  const { response: source, refresh } = useCreditsSource();
  const [testing, setTesting] = useState(false);

  function patchConfig(updates: Partial<CreditsWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function patchSection(id: CreditsSection["id"], updates: Partial<CreditsSection>) {
    patchConfig({ sections: cfg.sections.map((s) => (s.id === id ? { ...s, ...updates } : s)) });
  }

  function pickPreset(preset: CreditsWidgetPreset) {
    if (preset === cfg.preset) return;
    // Arcade swaps in its font and gives it back on the way out.
    const next: CreditsWidgetItemConfig = { ...cfg, ...creditsPresetChange(cfg, preset) };
    // One update, so undo takes the look and the resize back together.
    updateItem(item.id, { config: next, ...presetGeometry(item, CREDITS_WIDGET_PRESET_SIZES[preset]) });
  }

  function roll(data?: CreditsData) {
    if (!sceneId) return;
    const detail: CreditsRollBrowserEventDetail = { sceneId, data };
    window.dispatchEvent(new CustomEvent(CREDITS_ROLL_BROWSER_EVENT, { detail }));
    setTesting(true);
  }

  function stop() {
    if (!sceneId) return;
    window.dispatchEvent(
      new CustomEvent<CreditsResetBrowserEventDetail>(CREDITS_RESET_BROWSER_EVENT, { detail: { sceneId } }),
    );
    setTesting(false);
  }

  const scrolls = isCreditsScrollPreset(cfg.preset);
  const thanksOn = cfg.sections.some((s) => s.id === "thanks" && s.enabled);
  const hasRealData = source.status === "ready" && !source.data.missing.stream;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-input p-3 text-xs">
        {source.status === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Reading your last stream…
          </p>
        ) : source.status === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t read your stream just now. The widget reads again on its own when it rolls.
          </p>
        ) : source.data.missing.stream ? (
          <p className="text-muted-foreground">
            No stream to roll yet. Go live once with StreamWizard connected and the names show up here.
          </p>
        ) : source.data.is_live ? (
          <div className="space-y-0.5">
            <p className="font-medium">Live now</p>
            <p className="text-muted-foreground">{summary(source.data)} so far</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            <p className="font-medium">
              Last stream
              {source.data.started_at ? ` · ${dateFormat.format(new Date(source.data.started_at))}` : ""}
              {source.data.duration_seconds ? ` · ${formatCreditsDuration(source.data.duration_seconds)}` : ""}
            </p>
            <p className="text-muted-foreground">{summary(source.data)}</p>
          </div>
        )}
        <Button variant="outline" size="sm" className="w-full" onClick={refresh} disabled={source.status === "loading"}>
          <RefreshCw />
          Refresh
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Test</Label>
          <InspectorHint label="About the credits tests">
            Previews on this canvas only. On stream, the credits roll on their own when the scene with this
            overlay comes up.
          </InspectorHint>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => roll()} disabled={!hasRealData} title={hasRealData ? undefined : "Nothing to roll yet"}>
            <Play />
            Roll credits
          </Button>
          <Button variant="outline" size="sm" onClick={() => roll(buildDemoCreditsData())}>
            <Sparkles />
            Sample data
          </Button>
        </div>
        {testing && (
          <Button variant="ghost" size="sm" className="w-full" onClick={stop}>
            <Square />
            Stop
          </Button>
        )}
      </div>

      <InspectorSection title="Design" defaultOpen>
        <ToggleGroup
          type="single"
          value={cfg.preset}
          onValueChange={(v) => v && pickPreset(v as CreditsWidgetPreset)}
          spacing={2}
          aria-label="Design"
          className="grid w-full grid-cols-3"
        >
          {CREDITS_WIDGET_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset}
              value={preset}
              className="h-auto w-full flex-col items-stretch gap-1.5 border border-input p-1.5 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            >
              <div className="flex h-9 items-center justify-center">
                <PresetSketch preset={preset} />
              </div>
              <span className="text-center">{CREDITS_WIDGET_PRESET_LABELS[preset]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </InspectorSection>

      <InspectorSection title="Sections" defaultOpen>
        <div className="space-y-4">
          <div className="rounded-md border border-input">
            <SortableList
              id={`credits-sections-${item.id}`}
              items={cfg.sections}
              onReorder={(sections) => patchConfig({ sections })}
              itemLabel={(s) => CREDITS_SECTION_NAMES[s.id]}
              className="divide-border/60"
            >
              {(section) => (
                <div className="flex min-w-0 flex-1 items-center gap-2 py-1">
                  <Switch
                    checked={section.enabled}
                    onCheckedChange={(enabled) => patchSection(section.id, { enabled })}
                    aria-label={`Show ${CREDITS_SECTION_NAMES[section.id]}`}
                  />
                  <span className={cn("w-24 shrink-0 truncate text-xs", !section.enabled && "text-muted-foreground")}>
                    {CREDITS_SECTION_NAMES[section.id]}
                  </span>
                  {section.id === "title" ? (
                    <Input
                      value={cfg.titleText}
                      maxLength={CREDITS_WIDGET_LIMITS.titleText}
                      placeholder="Thanks for watching"
                      className="h-7 text-xs"
                      onChange={(e) => patchConfig({ titleText: e.target.value })}
                    />
                  ) : section.id === "outro" ? (
                    <Input
                      value={cfg.outroText}
                      maxLength={CREDITS_WIDGET_LIMITS.outroText}
                      placeholder="See you next stream"
                      className="h-7 text-xs"
                      onChange={(e) => patchConfig({ outroText: e.target.value })}
                    />
                  ) : creditsSectionHasLabel(section.id) ? (
                    <Input
                      value={section.label}
                      maxLength={CREDITS_WIDGET_LIMITS.sectionLabel}
                      placeholder="Heading"
                      className="h-7 text-xs"
                      onChange={(e) => patchSection(section.id, { label: e.target.value })}
                    />
                  ) : null}
                </div>
              )}
            </SortableList>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Drag to reorder. A section with nothing in it is skipped on stream.
          </p>

          <InspectorReveal show={thanksOn} marginTop={0}>
            <div className="space-y-1.5">
              <Label htmlFor="credits-widget-thanks" className="text-xs">
                Thank-you note
              </Label>
              <Textarea
                id="credits-widget-thanks"
                value={cfg.thanksText}
                maxLength={CREDITS_WIDGET_LIMITS.thanksText}
                rows={3}
                placeholder="A few words for everyone who stopped by."
                onChange={(e) => patchConfig({ thanksText: e.target.value })}
              />
            </div>
          </InspectorReveal>

          <div className="space-y-1">
            <SwitchField
              id="credits-widget-show-counts"
              label="Counts in headings"
              hint="New followers · 12"
              checked={cfg.showCounts}
              onCheckedChange={(showCounts) => patchConfig({ showCounts })}
            />
            <SwitchField
              id="credits-widget-show-values"
              label="Amounts after names"
              hint="How many Bits, subs or viewers each person brought."
              checked={cfg.showValues}
              onCheckedChange={(showValues) => patchConfig({ showValues })}
            />
            <SwitchField
              id="credits-widget-show-avatars"
              label="Profile pictures"
              checked={cfg.showAvatars}
              onCheckedChange={(showAvatars) => patchConfig({ showAvatars })}
            />
          </div>

          <SliderField
            id="credits-widget-max-names"
            label="Names per section"
            value={cfg.maxNamesPerSection}
            min={CREDITS_WIDGET_LIMITS.maxNamesPerSection.min}
            max={CREDITS_WIDGET_LIMITS.maxNamesPerSection.max}
            hint="0 shows everyone. Past the limit, the rest become one line: and 12 more."
            onChange={(maxNamesPerSection) => patchConfig({ maxNamesPerSection })}
          />
          <InspectorReveal show={cfg.maxNamesPerSection > 0} marginTop={0}>
            <div className="space-y-1.5">
              <Label htmlFor="credits-widget-more" className="text-xs">
                Line for the rest
              </Label>
              <Input
                id="credits-widget-more"
                value={cfg.moreText}
                maxLength={CREDITS_WIDGET_LIMITS.moreText}
                placeholder="and {n} more"
                onChange={(e) => patchConfig({ moreText: e.target.value })}
              />
              <p className="text-[11px] text-muted-foreground">{"{n}"} becomes the number left out.</p>
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Playback" defaultOpen>
        <div className="space-y-4">
          <InspectorReveal show={scrolls} marginTop={0}>
            <SliderField
              id="credits-widget-scroll-speed"
              label="Scroll speed"
              unit="px/s"
              value={cfg.scrollSpeed}
              min={CREDITS_WIDGET_LIMITS.scrollSpeed.min}
              max={CREDITS_WIDGET_LIMITS.scrollSpeed.max}
              onChange={(scrollSpeed) => patchConfig({ scrollSpeed })}
            />
          </InspectorReveal>
          <InspectorReveal show={!scrolls} marginTop={0}>
            <SliderField
              id="credits-widget-seconds-per-section"
              label="Seconds per section"
              unit="s"
              value={cfg.secondsPerSection}
              min={CREDITS_WIDGET_LIMITS.secondsPerSection.min}
              max={CREDITS_WIDGET_LIMITS.secondsPerSection.max}
              hint="Long lists get a little extra so they can be read."
              onChange={(secondsPerSection) => patchConfig({ secondsPerSection })}
            />
          </InspectorReveal>
          <SliderField
            id="credits-widget-start-delay"
            label="Start delay"
            unit="s"
            value={cfg.startDelaySeconds}
            min={CREDITS_WIDGET_LIMITS.startDelaySeconds.min}
            max={CREDITS_WIDGET_LIMITS.startDelaySeconds.max}
            hint="Time between the scene coming up and the first line."
            onChange={(startDelaySeconds) => patchConfig({ startDelaySeconds })}
          />
          <SegmentedField
            id="credits-widget-loop"
            label="When it ends"
            value={cfg.loop ? "loop" : "once"}
            options={LOOP_OPTIONS}
            hint={
              scrolls
                ? "Play once runs off the top and leaves the box empty. Loop keeps it moving, round and round."
                : "Play once keeps the last section up until you switch scenes. Loop starts over after a short hold."
            }
            onChange={(v) => patchConfig({ loop: v === "loop" })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Text">
        <div className="space-y-4">
          <GoogleFontSelect
            id="credits-widget-font-family"
            value={cfg.fontFamily}
            // A font picked by hand is theirs: leaving Arcade won't undo it.
            onValueChange={(fontFamily) => patchConfig({ fontFamily, arcadeRestoreFont: "" })}
          />
          <FontWeightSelect
            id="credits-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <SliderField
            id="credits-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={CREDITS_WIDGET_LIMITS.fontSize.min}
            max={CREDITS_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <SwitchField
            id="credits-widget-text-shadow"
            label="Text shadow"
            hint="Keeps the names readable over your ending scene."
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Text" value={cfg.textColor} onChange={(textColor) => patchConfig({ textColor })} />
            <ColorField label="Headings" value={cfg.accentColor} onChange={(accentColor) => patchConfig({ accentColor })} />
            <ColorField label="Background" value={cfg.backgroundColor} onChange={(backgroundColor) => patchConfig({ backgroundColor })} />
          </div>
          <SliderField
            id="credits-widget-background-opacity"
            label="Background opacity"
            unit="%"
            value={Math.round(cfg.backgroundOpacity * 100)}
            min={0}
            max={100}
            hint="0 leaves the widget see-through. Cards and Arcade draw their own plate when this is 0."
            onChange={(v) => patchConfig({ backgroundOpacity: v / 100 })}
          />
        </div>
      </InspectorSection>
    </div>
  );
}
