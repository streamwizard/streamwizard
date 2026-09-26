"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { env } from "@/lib/env";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { usePathname } from "next/navigation";
import { ExternalLink, Flag, Loader2, RotateCcw, Swords, Trophy, TrendingUp } from "lucide-react";
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
  POLL_RESET_BROWSER_EVENT,
  POLL_WIDGET_ANIMATIONS_IN,
  POLL_WIDGET_ANIMATIONS_OUT,
  POLL_WIDGET_CELEBRATIONS,
  POLL_WIDGET_LIMITS,
  POLL_WIDGET_PRESET_LABELS,
  POLL_WIDGET_PRESET_SIZES,
  POLL_WIDGET_PRESETS,
  GOAL_WIDGET_ANIMATION_LABELS,
  applyPollFrame,
  isDemoPollFrame,
  normalizePollWidgetConfig,
  seedPoll,
  subscribeToWsRoom,
  type AlertTestBrowserEventDetail,
  type FetchedPoll,
  type PollResetBrowserEventDetail,
  type PollWidgetCelebration,
  type PollWidgetColorMode,
  type PollWidgetFrame,
  type PollWidgetItemConfig,
  type PollWidgetPreset,
  type PollWidgetState,
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
  type SegmentedOption,
  presetGeometry,
} from "@/components/overlays/inspector-fields";
import { TwitchConnectButton } from "@/components/ui/twitch-scope-banner";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

/**
 * Polls are started on Twitch, from Stream Manager's quick actions (or /poll
 * in chat). Without a login, the dashboard home.
 */
function twitchPollsUrl(login: string | null): string {
  if (!login) return "https://dashboard.twitch.tv/";
  return `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/stream-manager`;
}

const COLOR_MODE_OPTIONS: readonly SegmentedOption<PollWidgetColorMode>[] = [
  { value: "palette", label: "Each choice" },
  { value: "leader", label: "Leader only" },
];

const CELEBRATION_LABELS: Record<PollWidgetCelebration, string> = {
  none: "None",
  glow: "Glow",
  confetti: "Confetti",
};

/** A tiny drawing of each design, so the grid reads before the labels do. */
function PresetSketch({ preset }: { preset: PollWidgetPreset }) {
  const fills = ["bg-primary/80", "bg-primary/55", "bg-primary/35"];
  const track = "bg-muted-foreground/25";
  switch (preset) {
    case "bars":
      return (
        <div className="flex w-full flex-col gap-0.5">
          {[0.7, 0.45, 0.2].map((w, i) => (
            <div key={i} className={cn("h-1.5 w-full overflow-hidden rounded-full", track)}>
              <div className={cn("h-full rounded-full", fills[i])} style={{ width: `${w * 100}%` }} />
            </div>
          ))}
        </div>
      );
    case "columns":
      return (
        <div className="flex h-8 w-full items-end justify-center gap-1">
          {[1, 0.6, 0.3].map((h, i) => (
            <div key={i} className={cn("w-2.5 rounded-t-sm", fills[i])} style={{ height: `${h * 100}%` }} />
          ))}
        </div>
      );
    case "donut":
      return (
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="4" className="stroke-muted-foreground/25" />
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="4" strokeDasharray="30 56.5" transform="rotate(-90 12 12)" className="stroke-primary/80" />
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="4" strokeDasharray="15 56.5" strokeDashoffset="-31" transform="rotate(-90 12 12)" className="stroke-primary/45" />
        </svg>
      );
    case "strip":
      return (
        <div className="flex w-full flex-col gap-1">
          <div className="flex justify-between">
            <div className="h-1 w-5 rounded-full bg-muted-foreground/50" />
            <div className="h-1 w-3 rounded-full bg-primary/70" />
          </div>
          <div className="flex h-0.5 w-full">
            <div className={cn("h-full w-1/2", fills[0])} />
            <div className={cn("h-full w-1/3", fills[1])} />
            <div className={cn("h-full flex-1", fills[2])} />
          </div>
        </div>
      );
    case "race":
      return (
        <div className="relative flex w-full flex-col gap-1.5 pr-1.5">
          {[0.75, 0.45, 0.2].map((p, i) => (
            <div key={i} className="relative h-px w-full bg-muted-foreground/40">
              <div className={cn("absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full", fills[i])} style={{ left: `${p * 85}%` }} />
            </div>
          ))}
          <div
            className="absolute inset-y-0 right-0 w-1"
            style={{ backgroundImage: "repeating-conic-gradient(currentColor 0 25%, transparent 0 50%)", backgroundSize: "4px 4px" }}
          />
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

type PollResponse =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; missingScope: boolean; login: string | null };

/**
 * The channel's poll for the "On Twitch now" line: fetched once, then kept
 * current from the scene's WS room, the same frames the canvas widget reads.
 * The test poll is left out; it isn't on Twitch. `testing` says one reached
 * the canvas, so the panel can offer to go back to the real data.
 */
function useTwitchPoll() {
  const [response, setResponse] = useState<PollResponse>({ status: "loading" });
  const [poll, setPoll] = useState<PollWidgetState>(null);
  const [testing, setTesting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const token = useOverlayStore((s) => s.scene?.subscriber_token);
  const sceneId = useOverlayStore((s) => s.scene?.id);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twitch/assets/poll");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { poll?: FetchedPoll | null; missing_scope?: boolean; login?: string | null };
        if (cancelled) return;
        // A refetch after a reset is the truth, so it replaces rather than merges.
        setPoll((prev) => seedPoll(refreshKey > 0 ? null : prev, body.poll ?? null));
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
      const frame = raw as PollWidgetFrame;
      if (isDemoPollFrame(frame)) {
        // A Live-mode test: it reached the canvas through the room.
        setTesting(true);
        return;
      }
      setPoll((prev) => applyPollFrame(prev, frame, Date.now()));
    });
  }, [token]);

  // Local-mode tests, from these Test buttons or the demo bar.
  useEffect(() => {
    const onTest = (e: Event) => {
      const detail = (e as CustomEvent<AlertTestBrowserEventDetail>).detail;
      if (detail && detail.sceneId === sceneId && isDemoPollFrame(detail.message)) setTesting(true);
    };
    window.addEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
    return () => window.removeEventListener(ALERT_TEST_BROWSER_EVENT, onTest);
  }, [sceneId]);

  /** Drops the test poll on the canvas and reads Twitch again, here and there. */
  const reset = useCallback(() => {
    if (!sceneId) return;
    setTesting(false);
    setRefreshKey((k) => k + 1);
    window.dispatchEvent(
      new CustomEvent<PollResetBrowserEventDetail>(POLL_RESET_BROWSER_EVENT, { detail: { sceneId } }),
    );
  }, [sceneId]);

  return { response, poll, testing, reset };
}

type PollTest = "begin" | "votes" | "close" | "end";

const numberFormat = new Intl.NumberFormat();

export function PollWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizePollWidgetConfig(item.config);
  const pathname = usePathname();
  const { response: twitch, poll, testing, reset } = useTwitchPoll();
  const { fire } = useDemoFire();
  const [testBusy, setTestBusy] = useState<PollTest | null>(null);

  // A closed poll isn't running any more.
  const active = poll && poll.endedAt === null ? poll : null;
  const activeVotes = active ? active.choices.reduce((sum, c) => sum + c.votes, 0) : 0;

  function patchConfig(updates: Partial<PollWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function pickPreset(preset: PollWidgetPreset) {
    if (preset === cfg.preset) return;
    // One update, so undo takes the look and the resize back together.
    updateItem(item.id, { config: { ...cfg, preset }, ...presetGeometry(item, POLL_WIDGET_PRESET_SIZES[preset]) });
  }

  function setChoiceColor(index: number, value: string) {
    const choiceColors = [...cfg.choiceColors];
    choiceColors[index] = value;
    patchConfig({ choiceColors });
  }

  async function sendTest(test: PollTest) {
    setTestBusy(test);
    try {
      if (test === "begin") await fire({ type: "channel.poll.begin" });
      else if (test === "votes") await fire({ type: "channel.poll.progress" });
      else if (test === "close") await fire({ type: "channel.poll.progress", variant: "close" });
      else await fire({ type: "channel.poll.end" });
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
            Checking for a poll on Twitch…
          </p>
        ) : twitch.status === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t reach Twitch just now. The widget still updates live when you start a poll.
          </p>
        ) : twitch.missingScope ? (
          <div className="space-y-2">
            <p>
              StreamWizard needs permission to read your polls. One quick trip to Twitch and the widget
              picks them up.
            </p>
            <TwitchConnectButton feature="base" next={pathname ?? "/dashboard"} className="w-full" />
          </div>
        ) : active ? (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">On Twitch now</p>
            {active.title && <p className="font-medium">{active.title}</p>}
            <p className="tabular-nums text-muted-foreground">
              {active.choices.length} choices · {numberFormat.format(activeVotes)}{" "}
              {activeVotes === 1 ? "vote" : "votes"}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No poll running. Start one on Twitch and it shows up here on its own.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a
            href={twitchPollsUrl(twitch.status === "ready" ? twitch.login : null)}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink />
            Start a poll on Twitch
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Test</Label>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" size="sm" onClick={() => sendTest("begin")} disabled={!!testBusy}>
            {testBusy === "begin" ? <Loader2 className="animate-spin" /> : <Flag />}
            Start
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendTest("votes")} disabled={!!testBusy}>
            {testBusy === "votes" ? <Loader2 className="animate-spin" /> : <TrendingUp />}
            Votes
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendTest("close")} disabled={!!testBusy}>
            {testBusy === "close" ? <Loader2 className="animate-spin" /> : <Swords />}
            Close race
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendTest("end")} disabled={!!testBusy}>
            {testBusy === "end" ? <Loader2 className="animate-spin" /> : <Trophy />}
            End
          </Button>
        </div>
        {testing && (
          <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
            <RotateCcw />
            Back to your Twitch poll
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

      <InspectorSection title="Poll" defaultOpen>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="poll-widget-title" className="text-xs">
              Title
            </Label>
            <Input
              id="poll-widget-title"
              value={cfg.title}
              maxLength={POLL_WIDGET_LIMITS.title}
              placeholder={active?.title || "Uses your poll's question from Twitch"}
              onChange={(e) => patchConfig({ title: e.target.value })}
            />
          </div>
          <SliderField
            id="poll-widget-hide-after"
            label="Show the result for"
            unit="s"
            value={cfg.hideAfterSeconds}
            min={POLL_WIDGET_LIMITS.hideAfterSeconds.min}
            max={POLL_WIDGET_LIMITS.hideAfterSeconds.max}
            hint="After the poll closes, the winner stays up this long. Then the widget hides until your next poll."
            onChange={(hideAfterSeconds) => patchConfig({ hideAfterSeconds })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Show" defaultOpen>
        <div className="space-y-1">
          <SwitchField
            id="poll-widget-show-title"
            label="Title"
            checked={cfg.showTitle}
            onCheckedChange={(showTitle) => patchConfig({ showTitle })}
          />
          <SwitchField
            id="poll-widget-show-percent"
            label="Percentage"
            checked={cfg.showPercent}
            onCheckedChange={(showPercent) => patchConfig({ showPercent })}
          />
          <SwitchField
            id="poll-widget-show-votes"
            label="Vote count"
            checked={cfg.showVotes}
            onCheckedChange={(showVotes) => patchConfig({ showVotes })}
          />
          <SwitchField
            id="poll-widget-show-timer"
            label="Countdown"
            checked={cfg.showTimer}
            onCheckedChange={(showTimer) => patchConfig({ showTimer })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <div className="space-y-4">
          <SegmentedField
            id="poll-widget-color-mode"
            label="Color"
            value={cfg.colorMode}
            options={COLOR_MODE_OPTIONS}
            hint="Each choice gets its own color, or only the choice in the lead stands out."
            onChange={(colorMode) => patchConfig({ colorMode })}
          />
          <div className="grid grid-cols-2 gap-2">
            {cfg.colorMode === "palette" ? (
              cfg.choiceColors.map((value, i) => (
                <ColorField key={i} label={`Choice ${i + 1}`} value={value} onChange={(v) => setChoiceColor(i, v)} />
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
            id="poll-widget-track-opacity"
            label="Track opacity"
            unit="%"
            value={Math.round(cfg.trackOpacity * 100)}
            min={0}
            max={100}
            onChange={(v) => patchConfig({ trackOpacity: v / 100 })}
          />
          <InspectorReveal show={hasRadius} marginTop={0}>
            <SliderField
              id="poll-widget-radius"
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
            id="poll-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(fontFamily) => patchConfig({ fontFamily })}
          />
          <FontWeightSelect
            id="poll-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <SliderField
            id="poll-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={POLL_WIDGET_LIMITS.fontSize.min}
            max={POLL_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <SwitchField
            id="poll-widget-text-shadow"
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
            id="poll-widget-pulse"
            label="Flash on votes"
            hint="A short flash on a choice every time it gets votes."
            checked={cfg.pulseOnVote}
            onCheckedChange={(pulseOnVote) => patchConfig({ pulseOnVote })}
          />
          <OptionSelect
            id="poll-widget-celebration"
            label="When the poll closes"
            value={cfg.celebration}
            options={POLL_WIDGET_CELEBRATIONS}
            labels={CELEBRATION_LABELS}
            hint="Plays when there's a clear winner. A tie gets no celebration."
            onChange={(celebration) => patchConfig({ celebration })}
          />
          <div className="grid grid-cols-2 gap-2">
            <OptionSelect
              id="poll-widget-animation-in"
              label="Poll starts"
              value={cfg.animationIn}
              options={POLL_WIDGET_ANIMATIONS_IN}
              labels={GOAL_WIDGET_ANIMATION_LABELS}
              onChange={(animationIn) => patchConfig({ animationIn })}
            />
            <OptionSelect
              id="poll-widget-animation-out"
              label="Poll hides"
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
