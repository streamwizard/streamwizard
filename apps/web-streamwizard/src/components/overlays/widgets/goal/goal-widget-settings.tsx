"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { env } from "@/lib/env";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { usePathname } from "next/navigation";
import { ExternalLink, Flag, Gauge, Loader2, PartyPopper, RotateCcw, TrendingUp } from "lucide-react";
import { buildDemoEvent } from "@repo/schemas";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import {
  Button,
  cn,
  ColorPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import {
  ALERT_TEST_BROWSER_EVENT,
  GOAL_RESET_BROWSER_EVENT,
  GOAL_WIDGET_ANIMATION_LABELS,
  GOAL_WIDGET_ANIMATIONS_IN,
  GOAL_WIDGET_ANIMATIONS_OUT,
  GOAL_WIDGET_CELEBRATION_LABELS,
  GOAL_WIDGET_CELEBRATIONS,
  GOAL_WIDGET_LABELS,
  GOAL_WIDGET_LIMITS,
  GOAL_WIDGET_PRESET_LABELS,
  GOAL_WIDGET_PRESET_SIZES,
  GOAL_WIDGET_PRESETS,
  goalPresetChange,
  isGoalWidgetType,
  applyGoalFrame,
  isDemoGoalFrame,
  normalizeGoalWidgetConfig,
  pickGoal,
  seedGoals,
  subscribeToWsRoom,
  TWITCH_GOAL_TYPE_LABELS,
  twitchGoalTypesFor,
  type AlertTestBrowserEventDetail,
  type FetchedGoal,
  type GoalResetBrowserEventDetail,
  type GoalWidgetFrame,
  type GoalWidgetState,
  type GoalWidgetItemConfig,
  type GoalWidgetFillMode,
  type GoalWidgetOnEnd,
  type GoalWidgetPreset,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  MediaField,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
  presetGeometry,
} from "@/components/overlays/inspector-fields";
import { TwitchConnectButton } from "@/components/ui/twitch-scope-banner";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

/**
 * Goals are made on Twitch; Helix has no way to create one. The dashboard's
 * search for "goals" lands on the goal settings; without a login, the
 * dashboard home.
 */
function twitchGoalsUrl(login: string | null): string {
  if (!login) return "https://dashboard.twitch.tv/";
  return `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/search?term=goals`;
}

const FILL_MODE_OPTIONS: readonly SegmentedOption<GoalWidgetFillMode>[] = [
  { value: "solid", label: "Solid" },
  { value: "gradient", label: "Gradient" },
];

/** A tiny drawing of each design, so the grid reads before the labels do. */
function PresetSketch({ preset }: { preset: GoalWidgetPreset }) {
  const fill = "bg-primary/80";
  const track = "bg-muted-foreground/25";
  switch (preset) {
    case "bar":
      return (
        <div className="flex w-full flex-col gap-1">
          <div className="h-1 w-6 rounded-full bg-muted-foreground/50" />
          <div className={cn("h-2 w-full overflow-hidden rounded-full", track)}>
            <div className={cn("h-full w-3/5 rounded-full", fill)} />
          </div>
        </div>
      );
    case "strip":
      return (
        <div className="flex w-full flex-col gap-1">
          <div className="flex justify-between">
            <div className="h-1 w-5 rounded-full bg-muted-foreground/50" />
            <div className="h-1 w-3 rounded-full bg-muted-foreground/50" />
          </div>
          <div className={cn("h-0.5 w-full", track)}>
            <div className={cn("h-full w-3/5", fill)} />
          </div>
        </div>
      );
    case "text":
      return (
        <div className="flex w-full flex-col items-center gap-1">
          <div className="h-1.5 w-8 rounded-sm bg-muted-foreground/70" />
          <div className="h-2 w-6 rounded-sm bg-muted-foreground/90" />
        </div>
      );
    case "ring":
      return (
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3.5" className="stroke-muted-foreground/25" />
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3.5" strokeDasharray="56.5" strokeDashoffset="20" strokeLinecap="round" transform="rotate(-90 12 12)" className="stroke-primary/80" />
        </svg>
      );
    case "blocks":
      return (
        <div className="flex w-full gap-0.5">
          {[1, 1, 1, 0, 0].map((on, i) => (
            <div key={i} className={cn("h-2.5 flex-1 rounded-[2px]", on ? fill : track)} />
          ))}
        </div>
      );
    case "tube":
      return (
        <div className="flex flex-col items-center">
          <div className={cn("relative h-6 w-1.5 overflow-hidden rounded-t-full", track)}>
            <div className={cn("absolute inset-x-0 bottom-0 h-3/5", fill)} />
          </div>
          <div className={cn("-mt-0.5 size-3 rounded-full", fill)} />
        </div>
      );
    case "arcade":
      return (
        <div className="w-full border-2 border-muted-foreground/60 p-px">
          <div className={cn("h-2 w-3/5", fill)} style={{ backgroundImage: "repeating-linear-gradient(90deg, transparent 0 5px, rgba(0,0,0,0.35) 5px 6px)" }} />
        </div>
      );
    case "liquid":
      return (
        <div className={cn("relative h-8 w-full overflow-hidden rounded-md", track)}>
          <svg viewBox="0 0 40 10" preserveAspectRatio="none" className="absolute inset-x-0 bottom-[45%] h-2 w-full" aria-hidden>
            <path d="M0 5 Q 5 0 10 5 T 20 5 T 30 5 T 40 5 V 10 H 0 Z" className="fill-primary/80" />
          </svg>
          <div className={cn("absolute inset-x-0 bottom-0 h-[45%]", fill)} />
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

function OptionSelect<T extends string>({
  id,
  label,
  value,
  options,
  labels,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  hint?: ReactNode;
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as T)}>
        <SelectTrigger id={id} size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {labels[option]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

const ON_END_OPTIONS: readonly SegmentedOption<GoalWidgetOnEnd>[] = [
  { value: "keep", label: "Keep showing" },
  { value: "hide", label: "Hide" },
];

type GoalsResponse =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; goals: FetchedGoal[]; missingScope: boolean; login: string | null };

/**
 * The channel's goals for the "On Twitch now" line: fetched once, then kept
 * current from the scene's WS room, the same frames the canvas widget reads.
 * Test goals are left out; they aren't on Twitch. `testing` says one reached
 * the canvas, so the panel can offer to go back to the real data.
 */
function useTwitchGoals() {
  const [response, setResponse] = useState<GoalsResponse>({ status: "loading" });
  const [goals, setGoals] = useState<GoalWidgetState>({});
  const [testing, setTesting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = useOverlayStore((s) => s.scene?.subscriber_token);
  const sceneId = useOverlayStore((s) => s.scene?.id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twitch/assets/goals");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          goals?: FetchedGoal[];
          missing_scope?: boolean;
          login?: string | null;
        };
        if (cancelled) return;
        const fetched = Array.isArray(body.goals) ? body.goals : [];
        // A refetch after a reset is the truth, so it replaces rather than merges.
        setGoals((prev) => seedGoals(refreshKey > 0 ? {} : prev, fetched));
        setResponse({
          status: "ready",
          goals: fetched,
          missingScope: body.missing_scope === true,
          login: typeof body.login === "string" && body.login ? body.login : null,
        });
      } catch {
        if (!cancelled) setResponse({ status: "failed" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  useEffect(() => {
    const wsUrl = env.NEXT_PUBLIC_WS_SERVER_URL;
    if (!token || !wsUrl) return;
    return subscribeToWsRoom(token, wsUrl, (raw) => {
      const frame = raw as GoalWidgetFrame;
      if (isDemoGoalFrame(frame)) {
        // A Live-mode test: it reached the canvas through the room.
        setTesting(true);
        return;
      }
      setGoals((prev) => applyGoalFrame(prev, frame, Date.now()));
    });
  }, [token]);

  // Local-mode tests, from these Test buttons or the demo bar.
  useEffect(() => {
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (detail && detail.sceneId === sceneId && isDemoGoalFrame(detail.message)) setTesting(true);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [sceneId]);

  /** Drops the test goals on the canvas and reads Twitch again, here and there. */
  const reset = useCallback(() => {
    if (!sceneId) return;
    setTesting(false);
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(
      new CustomEvent<GoalResetBrowserEventDetail>(GOAL_RESET_BROWSER_EVENT, { detail: { sceneId } }),
    );
  }, [sceneId]);

  return { response, goals, testing, reset };
}

const numberFormat = new Intl.NumberFormat();

export function GoalWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeGoalWidgetConfig(item.config);
  const type = isGoalWidgetType(item.type) ? item.type : "follower_goal_widget";
  const labels = GOAL_WIDGET_LABELS[type];
  const types = twitchGoalTypesFor(type);
  const pathname = usePathname();
  const { response: twitch, goals, testing, reset } = useTwitchGoals();
  const { fire } = useDemoFire();
  const [testBusy, setTestBusy] = useState<string | null>(null);

  // An ended goal is no longer running on Twitch, so it doesn't count as active.
  const latest = pickGoal(goals, types);
  const active = latest && !latest.ended ? latest : null;

  function patchConfig(updates: Partial<GoalWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function pickPreset(preset: GoalWidgetPreset) {
    if (preset === cfg.preset) return;
    // Arcade swaps in its font and square corners, and gives them back on the way out.
    const next: GoalWidgetItemConfig = { ...cfg, ...goalPresetChange(cfg, preset) };
    // One update, so undo takes the look and the resize back together.
    updateItem(item.id, { config: next, ...presetGeometry(item, GOAL_WIDGET_PRESET_SIZES[preset]) });
  }

  async function sendTest(event: "channel.goal.begin" | "channel.goal.progress" | "channel.goal.end") {
    // Aim at the kind of goal this widget would show right now.
    const variant = active?.type ?? types[0];
    setTestBusy(event);
    try {
      await fire({ type: event, variant });
    } finally {
      setTestBusy(null);
    }
  }

  async function sendAlmostThere() {
    // A progress fire at 90%, to see blocks light up and the edge pulse.
    const variant = active?.type ?? types[0];
    const { payload } = buildDemoEvent("channel.goal.progress", undefined, variant);
    const target = typeof payload.target_amount === "number" ? payload.target_amount : 100;
    setTestBusy("almost");
    try {
      await fire({
        type: "channel.goal.progress",
        variant,
        custom: { ...payload, current_amount: Math.ceil(target * 0.9) },
      });
    } finally {
      setTestBusy(null);
    }
  }

  const hasRadius = cfg.preset !== "arcade" && cfg.preset !== "ring" && cfg.preset !== "text";
  // Text draws no bar: nothing to fill or track. Its fill colour still tints confetti.
  const hasTrack = cfg.preset !== "text";

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-input p-3 text-xs">
        {twitch.status === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking your Twitch goals…
          </p>
        ) : twitch.status === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t reach Twitch just now. The widget still updates live when your goal moves.
          </p>
        ) : twitch.missingScope ? (
          <div className="space-y-2">
            <p>
              StreamWizard needs permission to read your goals. One quick trip to Twitch and the widget
              picks them up.
            </p>
            <TwitchConnectButton feature="base" next={pathname ?? "/dashboard"} className="w-full" />
          </div>
        ) : active ? (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">
              On Twitch now · {TWITCH_GOAL_TYPE_LABELS[active.type].name}
            </p>
            {active.description && <p className="font-medium">{active.description}</p>}
            <p className="tabular-nums text-muted-foreground">
              {numberFormat.format(active.current)} / {numberFormat.format(active.target)}{" "}
              {TWITCH_GOAL_TYPE_LABELS[active.type].unit}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No active {labels.noun} goal. Set one up on Twitch and it shows up here on its own.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a
            href={twitchGoalsUrl(twitch.status === "ready" ? twitch.login : null)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            Manage goals on Twitch
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Test</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => sendTest("channel.goal.begin")} disabled={!!testBusy}>
            {testBusy === "channel.goal.begin" ? <Loader2 className="animate-spin" /> : <Flag />}
            Start
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendTest("channel.goal.progress")} disabled={!!testBusy}>
            {testBusy === "channel.goal.progress" ? <Loader2 className="animate-spin" /> : <TrendingUp />}
            Progress
          </Button>
          <Button variant="outline" size="sm" onClick={sendAlmostThere} disabled={!!testBusy}>
            {testBusy === "almost" ? <Loader2 className="animate-spin" /> : <Gauge />}
            Almost there
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendTest("channel.goal.end")} disabled={!!testBusy}>
            {testBusy === "channel.goal.end" ? <Loader2 className="animate-spin" /> : <PartyPopper />}
            Reached
          </Button>
        </div>
        {testing && (
          <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
            <RotateCcw />
            Back to your Twitch goal
          </Button>
        )}
      </div>

      <InspectorSection title="Design" defaultOpen>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            value={cfg.preset}
            onValueChange={(v) => v && pickPreset(v as GoalWidgetPreset)}
            spacing={2}
            aria-label="Design"
            className="grid w-full grid-cols-4"
          >
            {GOAL_WIDGET_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset}
                value={preset}
                className="h-auto w-full flex-col items-stretch gap-1.5 border border-input p-1.5 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
              >
                <div className="flex h-9 items-center justify-center">
                  <PresetSketch preset={preset} />
                </div>
                <span className="text-center">{GOAL_WIDGET_PRESET_LABELS[preset]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <InspectorReveal show={cfg.preset === "blocks"} marginTop={0}>
            <SliderField
              id="goal-widget-blocks"
              label="Blocks"
              value={cfg.blockCount}
              min={GOAL_WIDGET_LIMITS.blockCount.min}
              max={GOAL_WIDGET_LIMITS.blockCount.max}
              hint="0 picks for you: one block per follow or sub for goals up to 20, otherwise 10."
              onChange={(blockCount) => patchConfig({ blockCount })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Goal" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-widget-title" className="text-xs">
              Title
            </Label>
            <Input
              id="goal-widget-title"
              value={cfg.title}
              maxLength={GOAL_WIDGET_LIMITS.title}
              placeholder={active?.description || "Uses your goal's name from Twitch"}
              onChange={(e) => patchConfig({ title: e.target.value })}
            />
          </div>

          <SegmentedField
            id="goal-widget-on-end"
            label="When the goal ends"
            value={cfg.onEnd}
            options={ON_END_OPTIONS}
            hint="Hide waits a few seconds so chat gets to see the full bar first."
            onChange={(onEnd) => patchConfig({ onEnd })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Show" defaultOpen>
        <div className="space-y-1">
          <SwitchField
            id="goal-widget-show-title"
            label="Title"
            checked={cfg.showTitle}
            onCheckedChange={(showTitle) => patchConfig({ showTitle })}
          />
          <SwitchField
            id="goal-widget-show-numbers"
            label="Numbers"
            checked={cfg.showNumbers}
            onCheckedChange={(showNumbers) => patchConfig({ showNumbers })}
          />
          <SwitchField
            id="goal-widget-show-percent"
            label="Percentage"
            checked={cfg.showPercent}
            onCheckedChange={(showPercent) => patchConfig({ showPercent })}
          />
          <SwitchField
            id="goal-widget-show-remaining"
            label="How many to go"
            checked={cfg.showRemaining}
            onCheckedChange={(showRemaining) => patchConfig({ showRemaining })}
          />
          <SwitchField
            id="goal-widget-show-icon"
            label="Icon"
            hint="A heart for followers, a star for subs, a gem for Bits. Or pick your own image."
            checked={cfg.showIcon}
            onCheckedChange={(showIcon) => patchConfig({ showIcon })}
          />
          <InspectorReveal show={cfg.showIcon} marginTop={8}>
            <MediaField
              label="Your own icon"
              kinds={["image"]}
              value={cfg.iconUrl}
              helper="Leave empty for the built-in icon."
              onChange={(iconUrl) => patchConfig({ iconUrl })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <div className="space-y-4">
          <SegmentedField
            id="goal-widget-fill-mode"
            label="Fill"
            value={cfg.fillMode}
            options={FILL_MODE_OPTIONS}
            onChange={(fillMode) => patchConfig({ fillMode })}
          />
          <div className="grid grid-cols-2 gap-2">
            <ColorField label={cfg.fillMode === "gradient" ? "From" : "Fill"} value={cfg.fillColor} onChange={(fillColor) => patchConfig({ fillColor })} />
            {cfg.fillMode === "gradient" ? (
              <ColorField label="To" value={cfg.fillColor2} onChange={(fillColor2) => patchConfig({ fillColor2 })} />
            ) : (
              <div />
            )}
            {hasTrack ? (
              <ColorField label="Track" value={cfg.trackColor} onChange={(trackColor) => patchConfig({ trackColor })} />
            ) : null}
            <ColorField label="Text" value={cfg.textColor} onChange={(textColor) => patchConfig({ textColor })} />
          </div>
          <InspectorReveal show={hasTrack} marginTop={0}>
            <SliderField
              id="goal-widget-track-opacity"
              label="Track opacity"
              unit="%"
              value={Math.round(cfg.trackOpacity * 100)}
              min={0}
              max={100}
              onChange={(v) => patchConfig({ trackOpacity: v / 100 })}
            />
          </InspectorReveal>
          <InspectorReveal show={hasRadius} marginTop={0}>
            <SliderField
              id="goal-widget-radius"
              label="Corner radius"
              unit="px"
              value={cfg.radius}
              min={GOAL_WIDGET_LIMITS.radius.min}
              max={GOAL_WIDGET_LIMITS.radius.max}
              onChange={(radius) => patchConfig({ radius })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Text">
        <div className="space-y-4">
          <GoogleFontSelect
            id="goal-widget-font-family"
            value={cfg.fontFamily}
            // A font picked by hand is theirs: leaving Arcade won't undo it.
            onValueChange={(fontFamily) => patchConfig({ fontFamily, arcadeRestoreFont: "" })}
          />
          <FontWeightSelect
            id="goal-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <SliderField
            id="goal-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={GOAL_WIDGET_LIMITS.fontSize.min}
            max={GOAL_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <SwitchField
            id="goal-widget-text-shadow"
            label="Text shadow"
            hint="Keeps the text readable over bright game footage."
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Motion">
        <div className="space-y-4">
          <SwitchField
            id="goal-widget-pulse"
            label="Flash on progress"
            hint="A short glow where the fill ends, every time the number goes up."
            checked={cfg.pulseOnProgress}
            onCheckedChange={(pulseOnProgress) => patchConfig({ pulseOnProgress })}
          />
          <OptionSelect
            id="goal-widget-celebration"
            label="When the goal is reached"
            value={cfg.celebration}
            options={GOAL_WIDGET_CELEBRATIONS}
            labels={GOAL_WIDGET_CELEBRATION_LABELS}
            hint={cfg.preset === "arcade" ? "Arcade always shows LEVEL UP too." : undefined}
            onChange={(celebration) => patchConfig({ celebration })}
          />
          <div className="grid grid-cols-2 gap-2">
            <OptionSelect
              id="goal-widget-animation-in"
              label="Goal starts"
              value={cfg.animationIn}
              options={GOAL_WIDGET_ANIMATIONS_IN}
              labels={GOAL_WIDGET_ANIMATION_LABELS}
              onChange={(animationIn) => patchConfig({ animationIn })}
            />
            <OptionSelect
              id="goal-widget-animation-out"
              label="Goal hides"
              value={cfg.animationOut}
              options={GOAL_WIDGET_ANIMATIONS_OUT}
              labels={GOAL_WIDGET_ANIMATION_LABELS}
              hint="Plays when When the goal ends is set to Hide."
              onChange={(animationOut) => patchConfig({ animationOut })}
            />
          </div>
        </div>
      </InspectorSection>
    </div>
  );
}
