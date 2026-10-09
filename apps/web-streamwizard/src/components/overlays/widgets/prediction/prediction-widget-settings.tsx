"use client";

import { useCallback, useEffect, useState } from "react";
import { env } from "@/lib/env";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { usePathname } from "next/navigation";
import { ExternalLink, Flag, Loader2, Lock, RotateCcw, Swords, Trophy, TrendingUp, Undo2 } from "lucide-react";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import { Button, Input, Label, ToggleGroup, ToggleGroupItem } from "@repo/ui";
import {
  ALERT_TEST_BROWSER_EVENT,
  GOAL_WIDGET_ANIMATION_LABELS,
  POLL_WIDGET_ANIMATIONS_IN,
  POLL_WIDGET_ANIMATIONS_OUT,
  POLL_WIDGET_CELEBRATIONS,
  POLL_WIDGET_LIMITS,
  POLL_WIDGET_PRESET_LABELS,
  POLL_WIDGET_PRESET_SIZES,
  POLL_WIDGET_PRESETS,
  PREDICTION_RESET_BROWSER_EVENT,
  applyPredictionFrame,
  isDemoPredictionFrame,
  normalizePredictionWidgetConfig,
  seedPrediction,
  subscribeToWsRoom,
  type AlertTestBrowserEventDetail,
  type FetchedPrediction,
  type PollWidgetColorMode,
  type PollWidgetPreset,
  type PredictionResetBrowserEventDetail,
  type PredictionWidgetFrame,
  type PredictionWidgetItemConfig,
  type PredictionWidgetState,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
  presetGeometry,
} from "@/components/overlays/inspector-fields";
import { TwitchConnectButton } from "@/components/ui/twitch-scope-banner";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";
// A prediction is drawn by the poll designs, so it borrows their pickers too.
import { CELEBRATION_LABELS, ColorField, OptionSelect, PresetSketch } from "../poll/poll-widget-settings";

/**
 * Predictions are started on Twitch, from Stream Manager's quick actions (or
 * /prediction in chat). Without a login, the dashboard home.
 */
function twitchPredictionsUrl(login: string | null): string {
  if (!login) return "https://dashboard.twitch.tv/";
  return `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/stream-manager`;
}

const COLOR_MODE_OPTIONS: readonly SegmentedOption<PollWidgetColorMode>[] = [
  { value: "palette", label: "Each outcome" },
  { value: "leader", label: "Leader only" },
];

type PredictionResponse =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; missingScope: boolean; login: string | null };

/**
 * The channel's prediction for the "On Twitch now" line: fetched once, then
 * kept current from the scene's WS room, the same frames the canvas widget
 * reads. The test prediction is left out; it isn't on Twitch. `testing` says
 * one reached the canvas, so the panel can offer to go back to the real data.
 */
function useTwitchPrediction() {
  const [response, setResponse] = useState<PredictionResponse>({ status: "loading" });
  const [prediction, setPrediction] = useState<PredictionWidgetState>(null);
  const [testing, setTesting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = useOverlayStore((s) => s.scene?.subscriber_token);
  const sceneId = useOverlayStore((s) => s.scene?.id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twitch/assets/prediction");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as {
          prediction?: FetchedPrediction | null;
          missing_scope?: boolean;
          login?: string | null;
        };
        if (cancelled) return;
        // A refetch after a reset is the truth, so it replaces rather than merges.
        setPrediction((prev) => seedPrediction(refreshKey > 0 ? null : prev, body.prediction ?? null));
        setResponse({
          status: "ready",
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
      const frame = raw as PredictionWidgetFrame;
      if (isDemoPredictionFrame(frame)) {
        // A Live-mode test: it reached the canvas through the room.
        setTesting(true);
        return;
      }
      setPrediction((prev) => applyPredictionFrame(prev, frame, Date.now()));
    });
  }, [token]);

  // Local-mode tests, from these Test buttons or the demo bar.
  useEffect(() => {
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (detail && detail.sceneId === sceneId && isDemoPredictionFrame(detail.message)) setTesting(true);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [sceneId]);

  /** Drops the test prediction on the canvas and reads Twitch again, here and there. */
  const reset = useCallback(() => {
    if (!sceneId) return;
    setTesting(false);
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(
      new CustomEvent<PredictionResetBrowserEventDetail>(PREDICTION_RESET_BROWSER_EVENT, { detail: { sceneId } }),
    );
  }, [sceneId]);

  return { response, prediction, testing, reset };
}

type PredictionTest = "begin" | "points" | "close" | "lock" | "win" | "refund";

const TESTS: { id: PredictionTest; label: string; icon: typeof Flag }[] = [
  { id: "begin", label: "Start", icon: Flag },
  { id: "points", label: "Points", icon: TrendingUp },
  { id: "close", label: "Close call", icon: Swords },
  { id: "lock", label: "Lock", icon: Lock },
  { id: "win", label: "Pick winner", icon: Trophy },
  { id: "refund", label: "Refund", icon: Undo2 },
];

const numberFormat = new Intl.NumberFormat();

export function PredictionWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizePredictionWidgetConfig(item.config);
  const pathname = usePathname();
  const { response: twitch, prediction, testing, reset } = useTwitchPrediction();
  const { fire } = useDemoFire();
  const [testBusy, setTestBusy] = useState<PredictionTest | null>(null);

  // One that is resolved or refunded isn't running any more.
  const running = prediction && prediction.endedAt === null ? prediction : null;
  const runningPoints = running ? running.outcomes.reduce((sum, o) => sum + o.points, 0) : 0;

  function patchConfig(updates: Partial<PredictionWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function pickPreset(preset: PollWidgetPreset) {
    if (preset === cfg.preset) return;
    // One update, so undo takes the look and the resize back together.
    updateItem(item.id, { config: { ...cfg, preset }, ...presetGeometry(item, POLL_WIDGET_PRESET_SIZES[preset]) });
  }

  function setOutcomeColor(index: number, value: string) {
    const choiceColors = [...cfg.choiceColors];
    choiceColors[index] = value;
    patchConfig({ choiceColors });
  }

  async function sendTest(test: PredictionTest) {
    setTestBusy(test);
    try {
      if (test === "begin") await fire({ type: "channel.prediction.begin" });
      else if (test === "points") await fire({ type: "channel.prediction.progress" });
      else if (test === "close") await fire({ type: "channel.prediction.progress", variant: "close" });
      else if (test === "lock") await fire({ type: "channel.prediction.lock" });
      else if (test === "win") await fire({ type: "channel.prediction.end" });
      else await fire({ type: "channel.prediction.end", variant: "canceled" });
    } finally {
      setTestBusy(null);
    }
  }

  const hasRadius = cfg.preset !== "donut" && cfg.preset !== "race";

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-input p-3 text-xs">
        {twitch.status === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking for a prediction on Twitch…
          </p>
        ) : twitch.status === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t reach Twitch just now. The widget still updates live when you start a prediction.
          </p>
        ) : twitch.missingScope ? (
          <div className="space-y-2">
            <p>
              StreamWizard needs permission to read your predictions. One quick trip to Twitch and the
              widget picks them up.
            </p>
            <TwitchConnectButton feature="base" next={pathname ?? "/dashboard"} className="w-full" />
          </div>
        ) : running ? (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">
              On Twitch now{running.status === "locked" ? " · locked, waiting for your pick" : ""}
            </p>
            {running.title && <p className="font-medium">{running.title}</p>}
            <p className="tabular-nums text-muted-foreground">
              {running.outcomes.length} outcomes · {numberFormat.format(runningPoints)}{" "}
              {runningPoints === 1 ? "point" : "points"}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No prediction running. Start one on Twitch and it shows up here on its own.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a
            href={twitchPredictionsUrl(twitch.status === "ready" ? twitch.login : null)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            Start a prediction on Twitch
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Test</Label>
        <div className="grid grid-cols-2 gap-2">
          {TESTS.map(({ id, label, icon: Icon }) => (
            <Button key={id} variant="outline" size="sm" onClick={() => sendTest(id)} disabled={!!testBusy}>
              {testBusy === id ? <Loader2 className="animate-spin" /> : <Icon />}
              {label}
            </Button>
          ))}
        </div>
        {testing && (
          <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
            <RotateCcw />
            Back to your Twitch prediction
          </Button>
        )}
      </div>

      <InspectorSection title="Design" defaultOpen>
        <ToggleGroup
          type="single"
          value={cfg.preset}
          onValueChange={(v) => v && pickPreset(v as PollWidgetPreset)}
          spacing={2}
          aria-label="Design"
          className="grid w-full grid-cols-3"
        >
          {POLL_WIDGET_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset}
              value={preset}
              className="h-auto w-full flex-col items-stretch gap-1.5 border border-input p-1.5 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            >
              <div className="flex h-9 items-center justify-center">
                <PresetSketch preset={preset} />
              </div>
              <span className="text-center">{POLL_WIDGET_PRESET_LABELS[preset]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </InspectorSection>

      <InspectorSection title="Prediction" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="prediction-widget-title" className="text-xs">
              Title
            </Label>
            <Input
              id="prediction-widget-title"
              value={cfg.title}
              maxLength={POLL_WIDGET_LIMITS.title}
              placeholder={running?.title || "Uses your prediction's question from Twitch"}
              onChange={(e) => patchConfig({ title: e.target.value })}
            />
          </div>
          <SwitchField
            id="prediction-widget-show-locked"
            label="Stay up while locked"
            hint="After predictions close, you still have to play it out. On keeps the widget up until you pick the winner. Off hides it and brings it back for the result."
            checked={cfg.showWhileLocked}
            onCheckedChange={(showWhileLocked) => patchConfig({ showWhileLocked })}
          />
          <SliderField
            id="prediction-widget-hide-after"
            label="Show the result for"
            unit="s"
            value={cfg.hideAfterSeconds}
            min={POLL_WIDGET_LIMITS.hideAfterSeconds.min}
            max={POLL_WIDGET_LIMITS.hideAfterSeconds.max}
            hint="After you pick the winner (or refund), the result stays up this long. Then the widget hides until your next prediction."
            onChange={(hideAfterSeconds) => patchConfig({ hideAfterSeconds })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Show" defaultOpen>
        <div className="space-y-1">
          <SwitchField
            id="prediction-widget-show-title"
            label="Title"
            checked={cfg.showTitle}
            onCheckedChange={(showTitle) => patchConfig({ showTitle })}
          />
          <SwitchField
            id="prediction-widget-show-percent"
            label="Percentage"
            checked={cfg.showPercent}
            onCheckedChange={(showPercent) => patchConfig({ showPercent })}
          />
          <SwitchField
            id="prediction-widget-show-points"
            label="Channel points"
            checked={cfg.showVotes}
            onCheckedChange={(showVotes) => patchConfig({ showVotes })}
          />
          <SwitchField
            id="prediction-widget-show-timer"
            label="Countdown"
            hint="Time left to predict. Once it locks, this spot says Locked."
            checked={cfg.showTimer}
            onCheckedChange={(showTimer) => patchConfig({ showTimer })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <div className="space-y-4">
          <SegmentedField
            id="prediction-widget-color-mode"
            label="Color"
            value={cfg.colorMode}
            options={COLOR_MODE_OPTIONS}
            hint="Each outcome gets its own color, or only the outcome in the lead stands out. Twitch allows up to 10 outcomes; most predictions use two."
            onChange={(colorMode) => patchConfig({ colorMode })}
          />
          <div className="grid grid-cols-2 gap-2">
            {cfg.colorMode === "palette" ? (
              cfg.choiceColors.map((value, i) => (
                <ColorField key={i} label={`Outcome ${i + 1}`} value={value} onChange={(v) => setOutcomeColor(i, v)} />
              ))
            ) : (
              <>
                <ColorField label="Leader" value={cfg.leaderColor} onChange={(leaderColor) => patchConfig({ leaderColor })} />
                <ColorField label="Others" value={cfg.otherColor} onChange={(otherColor) => patchConfig({ otherColor })} />
              </>
            )}
            <ColorField label="Track" value={cfg.trackColor} onChange={(trackColor) => patchConfig({ trackColor })} />
            <ColorField label="Text" value={cfg.textColor} onChange={(textColor) => patchConfig({ textColor })} />
          </div>
          <SliderField
            id="prediction-widget-track-opacity"
            label="Track opacity"
            unit="%"
            value={Math.round(cfg.trackOpacity * 100)}
            min={0}
            max={100}
            onChange={(v) => patchConfig({ trackOpacity: v / 100 })}
          />
          <InspectorReveal show={hasRadius} marginTop={0}>
            <SliderField
              id="prediction-widget-radius"
              label="Corner radius"
              unit="px"
              value={cfg.radius}
              min={POLL_WIDGET_LIMITS.radius.min}
              max={POLL_WIDGET_LIMITS.radius.max}
              onChange={(radius) => patchConfig({ radius })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Text">
        <div className="space-y-4">
          <GoogleFontSelect
            id="prediction-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <FontWeightSelect
            id="prediction-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <SliderField
            id="prediction-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={POLL_WIDGET_LIMITS.fontSize.min}
            max={POLL_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <SwitchField
            id="prediction-widget-text-shadow"
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
            id="prediction-widget-pulse"
            label="Flash on points"
            hint="A short flash on an outcome every time viewers put points on it."
            checked={cfg.pulseOnVote}
            onCheckedChange={(pulseOnVote) => patchConfig({ pulseOnVote })}
          />
          <OptionSelect
            id="prediction-widget-celebration"
            label="When you pick the winner"
            value={cfg.celebration}
            options={POLL_WIDGET_CELEBRATIONS}
            labels={CELEBRATION_LABELS}
            hint="Plays for the winning outcome. A refund gets no celebration."
            onChange={(celebration) => patchConfig({ celebration })}
          />
          <div className="grid grid-cols-2 gap-2">
            <OptionSelect
              id="prediction-widget-animation-in"
              label="Prediction starts"
              value={cfg.animationIn}
              options={POLL_WIDGET_ANIMATIONS_IN}
              labels={GOAL_WIDGET_ANIMATION_LABELS}
              onChange={(animationIn) => patchConfig({ animationIn })}
            />
            <OptionSelect
              id="prediction-widget-animation-out"
              label="Prediction hides"
              value={cfg.animationOut}
              options={POLL_WIDGET_ANIMATIONS_OUT}
              labels={GOAL_WIDGET_ANIMATION_LABELS}
              onChange={(animationOut) => patchConfig({ animationOut })}
            />
          </div>
        </div>
      </InspectorSection>
    </div>
  );
}
