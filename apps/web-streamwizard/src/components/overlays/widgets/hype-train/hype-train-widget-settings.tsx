"use client";

import { useRef, useState } from "react";
import { Flag, Play, RotateCcw, TrainFront, TrendingUp, UserPlus } from "lucide-react";
import {
  Button,
  ColorPicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import { buildWidgetTestEvent } from "@repo/schemas";
import {
  HYPE_TRAIN_PREVIEW_EVENT,
  HYPE_TRAIN_WIDGET_JOIN_EFFECTS,
  HYPE_TRAIN_WIDGET_JOIN_EFFECT_LABELS,
  HYPE_TRAIN_WIDGET_LIMITS,
  HYPE_TRAIN_WIDGET_PRESETS,
  HYPE_TRAIN_WIDGET_PRESET_LABELS,
  createDefaultHypeTrainWidgetConfig,
  normalizeHypeTrainWidgetConfig,
  type HypeTrainPreviewDetail,
  type HypeTrainWidgetDirection,
  type HypeTrainWidgetItemConfig,
  type HypeTrainWidgetJoinEffect,
  type HypeTrainWidgetMovement,
  type HypeTrainWidgetPreset,
} from "@repo/ui/overlay";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

const PRESET_OPTIONS: readonly SegmentedOption<HypeTrainWidgetPreset>[] = HYPE_TRAIN_WIDGET_PRESETS.map((p) => ({
  value: p,
  label: HYPE_TRAIN_WIDGET_PRESET_LABELS[p],
}));

const MOVEMENT_OPTIONS: readonly SegmentedOption<HypeTrainWidgetMovement>[] = [
  { value: "bounce", label: "Bounce around" },
  { value: "across", label: "Straight across" },
];

const DIRECTION_OPTIONS: readonly SegmentedOption<HypeTrainWidgetDirection>[] = [
  { value: "ltr", label: "Left to right" },
  { value: "rtl", label: "Right to left" },
];

const TEST_NAMES = [
  "CozyCactus",
  "TurboTaco",
  "LunaLoops",
  "NightOwlNia",
  "GlitchGoblin",
  "MochiMage",
  "RetroRaccoon",
  "SirSnacksAlot",
];

/** The test train's own id, so begin, progress and end all belong to one train. */
interface TestTrain {
  id: string;
  level: number;
}

function randomId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `test-${Math.random().toString(36).slice(2)}`;
}

export function HypeTrainWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeHypeTrainWidgetConfig(item.config);
  const { fire } = useDemoFire();
  const trainRef = useRef<TestTrain | null>(null);
  const riderRef = useRef(0);
  const [running, setRunning] = useState(false);

  function patchConfig(updates: Partial<HypeTrainWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function preview() {
    window.dispatchEvent(
      new CustomEvent<HypeTrainPreviewDetail>(HYPE_TRAIN_PREVIEW_EVENT, { detail: { itemId: item.id } }),
    );
  }

  async function startTrain() {
    const train = { id: randomId(), level: 1 };
    trainRef.current = train;
    setRunning(true);
    const payload = buildWidgetTestEvent("channel.hype_train.begin").payload;
    await fire({ type: "channel.hype_train.begin", custom: { ...payload, id: train.id, level: 1 } });
  }

  /** A cheer, a sub and a gift from three new test viewers. */
  async function addRiders() {
    const next = () => {
      const n = riderRef.current++;
      const userName = `${TEST_NAMES[n % TEST_NAMES.length]}${n >= TEST_NAMES.length ? n : ""}`;
      // Not a real Twitch id, so the widget won't look up someone's avatar for it.
      return { userName, user_id: `test-${n}`, user_login: userName.toLowerCase(), user_name: userName };
    };
    const fires = [
      { type: "channel.cheer" as const, bits: 100 * (1 + Math.floor(Math.random() * 20)) },
      { type: "channel.subscribe" as const },
      { type: "channel.subscription.gift" as const, total: 1 + Math.floor(Math.random() * 10) },
    ];
    for (const f of fires) {
      const { userName, ...who } = next();
      const { type, ...extra } = f;
      const payload = buildWidgetTestEvent(type, { userName }).payload;
      await fire({ type, custom: { ...payload, ...who, ...extra } });
    }
  }

  async function levelUp() {
    const train = trainRef.current;
    if (!train) return;
    train.level += 1;
    const payload = buildWidgetTestEvent("channel.hype_train.progress").payload;
    await fire({ type: "channel.hype_train.progress", custom: { ...payload, id: train.id, level: train.level } });
  }

  async function endTrain() {
    const train = trainRef.current;
    if (!train) return;
    trainRef.current = null;
    setRunning(false);
    const payload = buildWidgetTestEvent("channel.hype_train.end").payload;
    await fire({ type: "channel.hype_train.end", custom: { ...payload, id: train.id, level: train.level } });
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={startTrain}>
            <TrainFront />
            {running ? "Start a new test train" : "Start a test train"}
          </Button>
          <Button variant="outline" size="sm" onClick={preview} aria-label="Preview the ride">
            <Play />
            Preview
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button variant="outline" size="sm" onClick={addRiders}>
            <UserPlus />
            Riders
          </Button>
          <Button variant="outline" size="sm" onClick={levelUp} disabled={!running}>
            <TrendingUp />
            Level up
          </Button>
          <Button variant="outline" size="sm" onClick={endTrain} disabled={!running}>
            <Flag />
            End
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The train rolls in when a hype train starts and keeps riding until it ends, then drives off. Everyone
          who cheers, subs or gifts subs gets a wagon, and so does anyone who chipped in during the five minutes
          that got it started. The biggest supporters ride up front.
        </p>
      </div>

      <InspectorSection title="Ride" defaultOpen>
        <div className="space-y-4">
          <SegmentedField
            id="hype-train-movement"
            label="Movement"
            hint="Bounce around: the train roams the whole widget and bounces off the edges, like a DVD logo on standby. Straight across: it crosses from side to side along the bottom of the widget, again and again."
            value={cfg.movement}
            options={MOVEMENT_OPTIONS}
            onChange={(movement) => patchConfig({ movement })}
          />
          <InspectorReveal show={cfg.movement === "across"} marginTop={0}>
            <SegmentedField
              id="hype-train-direction"
              label="Direction"
              value={cfg.direction}
              options={DIRECTION_OPTIONS}
              onChange={(direction) => patchConfig({ direction })}
            />
          </InspectorReveal>
          <SliderField
            id="hype-train-speed"
            label="Speed"
            unit="px/s"
            value={cfg.speed}
            min={HYPE_TRAIN_WIDGET_LIMITS.speed.min}
            max={HYPE_TRAIN_WIDGET_LIMITS.speed.max}
            onChange={(speed) => patchConfig({ speed })}
          />
          <SliderField
            id="hype-train-speed-per-level"
            label="Faster every level"
            unit="%"
            hint="Each level up speeds the train up by this much over its starting speed. At 15%, level 5 rides 60% faster. 0 keeps it at the same speed all train."
            value={cfg.speedPerLevel}
            min={HYPE_TRAIN_WIDGET_LIMITS.speedPerLevel.min}
            max={HYPE_TRAIN_WIDGET_LIMITS.speedPerLevel.max}
            onChange={(speedPerLevel) => patchConfig({ speedPerLevel })}
          />
          <SliderField
            id="hype-train-wagons"
            label="Wagons"
            hint="Riders past this share one last wagon that says how many more there are."
            value={cfg.maxWagons}
            min={HYPE_TRAIN_WIDGET_LIMITS.maxWagons.min}
            max={HYPE_TRAIN_WIDGET_LIMITS.maxWagons.max}
            onChange={(maxWagons) => patchConfig({ maxWagons })}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label htmlFor="hype-train-join" className="text-xs">
                New riders arrive
              </Label>
              <InspectorHint label="About new riders">
                How a new rider&apos;s wagon joins the moving train. Wagons are ranked by support, so a big
                contributor lands near the engine and everyone behind slides back to make room.
              </InspectorHint>
            </div>
            <Select
              value={cfg.joinEffect}
              onValueChange={(v) => patchConfig({ joinEffect: v as HypeTrainWidgetJoinEffect })}
            >
              <SelectTrigger id="hype-train-join" size="sm" className="w-full text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HYPE_TRAIN_WIDGET_JOIN_EFFECTS.map((effect) => (
                  <SelectItem key={effect} value={effect} className="text-xs">
                    {HYPE_TRAIN_WIDGET_JOIN_EFFECT_LABELS[effect]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Look" defaultOpen>
        <div className="space-y-4">
          <SliderField
            id="hype-train-size"
            label="Train size"
            unit="px"
            hint="How tall the train is. It never gets taller than the widget."
            value={cfg.trainSize}
            min={HYPE_TRAIN_WIDGET_LIMITS.trainSize.min}
            max={HYPE_TRAIN_WIDGET_LIMITS.trainSize.max}
            onChange={(trainSize) => patchConfig({ trainSize })}
          />
          <SegmentedField
            id="hype-train-preset"
            label="Train"
            value={cfg.preset}
            options={PRESET_OPTIONS}
            onChange={(preset) => patchConfig({ preset })}
          />
          <SwitchField
            id="hype-train-avatars"
            label="Profile pictures"
            checked={cfg.showAvatars}
            onCheckedChange={(showAvatars) => patchConfig({ showAvatars })}
          />
          <SwitchField
            id="hype-train-amounts"
            label="Bits and subs"
            hint="Shows what each rider gave, like 1.2K bits · 3 subs."
            checked={cfg.showAmounts}
            onCheckedChange={(showAmounts) => patchConfig({ showAmounts })}
          />
          <SwitchField
            id="hype-train-level"
            label="Level on the engine"
            checked={cfg.showLevel}
            onCheckedChange={(showLevel) => patchConfig({ showLevel })}
          />
          <GoogleFontSelect
            id="hype-train-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <div className="grid grid-cols-3 gap-3">
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Train</Label>
              <ColorPicker
                value={cfg.trainColor}
                onChange={(trainColor) => patchConfig({ trainColor })}
                aria-label="Train color"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Trim</Label>
              <ColorPicker
                value={cfg.accentColor}
                onChange={(accentColor) => patchConfig({ accentColor })}
                aria-label="Trim color"
              />
            </div>
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Text</Label>
              <ColorPicker value={cfg.color} onChange={(color) => patchConfig({ color })} aria-label="Text color" />
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            Golden Kappa trains ride in gold.
            <InspectorHint label="About Golden Kappa trains">
              Twitch sometimes runs a Golden Kappa train. The widget paints those gold, whatever colours you pick here.
            </InspectorHint>
          </div>
        </div>
      </InspectorSection>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => patchConfig(createDefaultHypeTrainWidgetConfig())}
      >
        <RotateCcw />
        Reset to defaults
      </Button>
    </div>
  );
}
