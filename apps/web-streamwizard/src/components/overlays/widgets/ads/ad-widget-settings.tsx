"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useOverlayStore } from "@/stores/overlay-editor-store";
import { usePathname } from "next/navigation";
import { AlarmClock, ExternalLink, Loader2, RotateCcw, Tv } from "lucide-react";
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
  AD_RESET_BROWSER_EVENT,
  AD_SCHEDULE_TEST_BROWSER_EVENT,
  AD_WIDGET_ANIMATIONS_IN,
  AD_WIDGET_ANIMATIONS_OUT,
  AD_WIDGET_LIMITS,
  AD_WIDGET_PRESET_LABELS,
  AD_WIDGET_PRESET_SIZES,
  AD_WIDGET_PRESETS,
  GOAL_WIDGET_ANIMATION_LABELS,
  formatAdTime,
  normalizeAdWidgetConfig,
  scheduleFrom,
  type AdResetBrowserEventDetail,
  type AdScheduleSnapshot,
  type AdScheduleTestBrowserEventDetail,
  type AdWidgetItemConfig,
  type AdWidgetPreset,
  type FetchedAdSchedule,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SliderField,
  SwitchField,
  presetGeometry,
} from "@/components/overlays/inspector-fields";
import { TwitchConnectButton } from "@/components/ui/twitch-scope-banner";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

/** Ads Manager, where the ad schedule is set. Without a login, the dashboard home. */
function adsManagerUrl(login: string | null): string {
  if (!login) return "https://dashboard.twitch.tv/";
  return `https://dashboard.twitch.tv/u/${encodeURIComponent(login)}/settings/revenue/ads-manager`;
}

/** A tiny drawing of each design, so the grid reads before the labels do. */
function PresetSketch({ preset }: { preset: AdWidgetPreset }) {
  const fill = "bg-primary/80";
  const track = "bg-muted-foreground/25";
  switch (preset) {
    case "badge":
      return (
        <div className={cn("flex h-5 w-full items-center gap-1.5 overflow-hidden rounded-md px-1", track)}>
          <div className="h-3.5 w-4 shrink-0 rounded-sm bg-primary/80" />
          <div className="h-1 w-7 rounded-full bg-muted-foreground/60" />
        </div>
      );
    case "pill":
      return (
        <div className={cn("relative flex h-4 w-full items-center gap-1 overflow-hidden rounded-full px-1.5", track)}>
          <div className="size-2 rounded-full bg-primary/80" />
          <div className="h-1 w-6 rounded-full bg-muted-foreground/60" />
          <div className={cn("absolute bottom-0 left-0 h-0.5 w-3/5", fill)} />
        </div>
      );
    case "bar":
      return (
        <div className="flex w-full flex-col gap-1">
          <div className="h-1 w-8 rounded-full bg-muted-foreground/50" />
          <div className={cn("h-2 w-full overflow-hidden rounded-full", track)}>
            <div className={cn("h-full w-3/5 rounded-full", fill)} />
          </div>
        </div>
      );
    case "card":
      return (
        <div className={cn("relative flex h-8 w-full flex-col justify-center gap-1 overflow-hidden rounded-md px-1.5", track)}>
          <div className="h-1.5 w-8 rounded-full bg-muted-foreground/60" />
          <div className="h-1 w-6 rounded-full bg-muted-foreground/40" />
          <div className={cn("absolute bottom-0 left-0 h-1 w-3/5", fill)} />
        </div>
      );
    case "ring":
      return (
        <svg viewBox="0 0 24 24" className="size-8" aria-hidden>
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" className="stroke-muted-foreground/25" />
          <circle cx="12" cy="12" r="9" fill="none" strokeWidth="3" strokeDasharray="56.5" strokeDashoffset="22" strokeLinecap="round" transform="rotate(-90 12 12)" className="stroke-primary/80" />
        </svg>
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
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
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

function TextField({
  id,
  label,
  value,
  placeholder,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  hint?: ReactNode;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1">
        <Label htmlFor={id} className="text-xs">
          {label}
        </Label>
        {hint ? <InspectorHint label={`About ${label.toLowerCase()}`}>{hint}</InspectorHint> : null}
      </div>
      <Input id={id} value={value} maxLength={AD_WIDGET_LIMITS.text} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

type ScheduleResponse =
  | { status: "loading" }
  | { status: "failed" }
  | { status: "ready"; schedule: AdScheduleSnapshot | null; missingScope: boolean; login: string | null };

/** The channel's ad schedule for the status card, read once when the panel opens. */
function useTwitchAdSchedule() {
  const [response, setResponse] = useState<ScheduleResponse>({ status: "loading" });
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/twitch/assets/ads");
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { schedule?: FetchedAdSchedule | null; missing_scope?: boolean; login?: string | null };
        if (cancelled) return;
        setResponse({
          status: "ready",
          schedule: scheduleFrom(body.schedule),
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

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);
  return { response, refresh };
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const TIME_HINT = "{time} becomes the countdown, like 1:30.";

export function AdWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeAdWidgetConfig(item.config);
  const pathname = usePathname();
  const sceneId = useOverlayStore((s) => s.scene?.id);
  const { response: twitch, refresh } = useTwitchAdSchedule();
  const { fire, mode } = useDemoFire();
  const [testBusy, setTestBusy] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const now = useNow();

  function patchConfig(updates: Partial<AdWidgetItemConfig>) {
    updateItem(item.id, { config: { ...cfg, ...updates } });
  }

  function pickPreset(preset: AdWidgetPreset) {
    if (preset === cfg.preset) return;
    // One update, so undo takes the look and the resize back together.
    updateItem(item.id, { config: { ...cfg, preset }, ...presetGeometry(item, AD_WIDGET_PRESET_SIZES[preset]) });
  }

  function sendAdComing() {
    if (!sceneId) return;
    // Twitch has no event for an upcoming ad, so this preview stays on this canvas.
    const detail: AdScheduleTestBrowserEventDetail = {
      sceneId,
      nextAdAt: Date.now() + cfg.warnMinutes * 60_000 - 2000,
      duration: 60,
    };
    window.dispatchEvent(new CustomEvent(AD_SCHEDULE_TEST_BROWSER_EVENT, { detail }));
    setTesting(true);
  }

  async function sendAdBreak(seconds: number) {
    const key = `break-${seconds}`;
    setTestBusy(key);
    try {
      const { payload } = buildDemoEvent("channel.ad_break.begin");
      await fire({ type: "channel.ad_break.begin", custom: { ...payload, duration_seconds: seconds } });
      setTesting(true);
    } finally {
      setTestBusy(null);
    }
  }

  function reset() {
    if (!sceneId) return;
    setTesting(false);
    refresh();
    window.dispatchEvent(new CustomEvent<AdResetBrowserEventDetail>(AD_RESET_BROWSER_EVENT, { detail: { sceneId } }));
  }

  const schedule = twitch.status === "ready" ? twitch.schedule : null;
  const nextIn = schedule?.nextAdAt != null ? schedule.nextAdAt - now : null;

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-md border border-input p-3 text-xs">
        {twitch.status === "loading" ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Checking your ad schedule…
          </p>
        ) : twitch.status === "failed" ? (
          <p className="text-muted-foreground">
            Couldn&apos;t reach Twitch just now. Ad breaks still show up live when they start.
          </p>
        ) : twitch.missingScope ? (
          <div className="space-y-2">
            <p>
              StreamWizard needs permission to read your ad schedule. One quick trip to Twitch and the widget
              picks it up.
            </p>
            <TwitchConnectButton feature="base" next={pathname ?? "/dashboard"} className="w-full" />
          </div>
        ) : nextIn !== null && nextIn > 0 ? (
          <div className="space-y-0.5">
            <p className="text-muted-foreground">On Twitch now</p>
            <p className="font-medium tabular-nums">Next ad in {formatAdTime(nextIn / 1000)}</p>
            <p className="tabular-nums text-muted-foreground">
              {schedule!.duration > 0 ? `${schedule!.duration} s break` : "Break length unknown"} ·{" "}
              {schedule!.snoozeCount === 1 ? "1 snooze left" : `${schedule!.snoozeCount} snoozes left`}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">
            No ad scheduled right now. Twitch only schedules ads while you&apos;re live with Ads Manager on.
          </p>
        )}
        <Button variant="outline" size="sm" className="w-full" asChild>
          <a href={adsManagerUrl(twitch.status === "ready" ? twitch.login : null)} target="_blank" rel="noopener noreferrer">
            <ExternalLink />
            Open Ads Manager on Twitch
          </a>
        </Button>
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Label className="text-xs">Test</Label>
          <InspectorHint label="About the ad tests">
            Ad coming plays on this canvas only: Twitch has no event for an upcoming ad, so there&apos;s nothing to send
            to your live overlay. Ad breaks follow the demo bar&apos;s Local and Live switch.
          </InspectorHint>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            className="col-span-2"
            onClick={sendAdComing}
            disabled={!!testBusy}
            title={mode === "live" ? "Plays on this canvas only" : undefined}
          >
            <AlarmClock />
            Ad coming
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendAdBreak(30)} disabled={!!testBusy} title="30-second ad break">
            {testBusy === "break-30" ? <Loader2 className="animate-spin" /> : <Tv />}
            30 s break
          </Button>
          <Button variant="outline" size="sm" onClick={() => sendAdBreak(60)} disabled={!!testBusy} title="60-second ad break">
            {testBusy === "break-60" ? <Loader2 className="animate-spin" /> : <Tv />}
            60 s break
          </Button>
        </div>
        {testing && (
          <Button variant="ghost" size="sm" className="w-full" onClick={reset}>
            <RotateCcw />
            Back to your Twitch schedule
          </Button>
        )}
      </div>

      <InspectorSection title="Design" defaultOpen>
        <ToggleGroup
          type="single"
          value={cfg.preset}
          onValueChange={(v) => v && pickPreset(v as AdWidgetPreset)}
          spacing={2}
          aria-label="Design"
          className="grid w-full grid-cols-3"
        >
          {AD_WIDGET_PRESETS.map((preset) => (
            <ToggleGroupItem
              key={preset}
              value={preset}
              className="h-auto w-full flex-col items-stretch gap-1.5 border border-input p-1.5 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
            >
              <div className="flex h-9 items-center justify-center">
                <PresetSketch preset={preset} />
              </div>
              <span className="text-center">{AD_WIDGET_PRESET_LABELS[preset]}</span>
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </InspectorSection>

      <InspectorSection title="When" defaultOpen>
        <div className="space-y-1">
          <SwitchField
            id="ad-widget-show-warning"
            label="Before an ad"
            hint="A heads-up in the last minutes before a scheduled ad, from your Ads Manager schedule."
            checked={cfg.showWarning}
            onCheckedChange={(showWarning) => patchConfig({ showWarning })}
          />
          <InspectorReveal show={cfg.showWarning} marginTop={4}>
            <SliderField
              id="ad-widget-warn-minutes"
              label="Show it this long before"
              unit=" min"
              value={cfg.warnMinutes}
              min={AD_WIDGET_LIMITS.warnMinutes.min}
              max={AD_WIDGET_LIMITS.warnMinutes.max}
              step={0.5}
              onChange={(warnMinutes) => patchConfig({ warnMinutes })}
            />
          </InspectorReveal>
          <SwitchField
            id="ad-widget-show-running"
            label="During the ad break"
            checked={cfg.showRunning}
            onCheckedChange={(showRunning) => patchConfig({ showRunning })}
          />
          <SwitchField
            id="ad-widget-show-back"
            label="Welcome back"
            hint="A short line for 5 seconds after the break."
            checked={cfg.showBackMessage}
            onCheckedChange={(showBackMessage) => patchConfig({ showBackMessage })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Text" defaultOpen>
        <div className="space-y-4">
          <TextField
            id="ad-widget-warning-text"
            label="Before an ad"
            value={cfg.warningText}
            placeholder="Ads in {time}"
            hint={TIME_HINT}
            onChange={(warningText) => patchConfig({ warningText })}
          />
          <TextField
            id="ad-widget-running-text"
            label="During the break"
            value={cfg.runningText}
            placeholder="Ad break · back in {time}"
            hint={TIME_HINT}
            onChange={(runningText) => patchConfig({ runningText })}
          />
          <TextField
            id="ad-widget-back-text"
            label="Welcome back"
            value={cfg.backText}
            placeholder="Thanks for sticking around"
            onChange={(backText) => patchConfig({ backText })}
          />
          <InspectorReveal show={cfg.preset === "card"} marginTop={0}>
            <TextField
              id="ad-widget-card-message"
              label="Card message"
              value={cfg.cardMessage}
              placeholder="Stretch, grab a drink. Back soon."
              hint="Shows under the countdown while the ads run. Leave it empty for none."
              onChange={(cardMessage) => patchConfig({ cardMessage })}
            />
          </InspectorReveal>
          <SwitchField
            id="ad-widget-show-icon"
            label="Icon"
            checked={cfg.showIcon}
            onCheckedChange={(showIcon) => patchConfig({ showIcon })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Colors">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Accent" value={cfg.accentColor} onChange={(accentColor) => patchConfig({ accentColor })} />
            <ColorField label="Background" value={cfg.trackColor} onChange={(trackColor) => patchConfig({ trackColor })} />
            <ColorField label="Text" value={cfg.textColor} onChange={(textColor) => patchConfig({ textColor })} />
          </div>
          <SliderField
            id="ad-widget-track-opacity"
            label="Background opacity"
            unit="%"
            value={Math.round(cfg.trackOpacity * 100)}
            min={0}
            max={100}
            onChange={(v) => patchConfig({ trackOpacity: v / 100 })}
          />
          <InspectorReveal show={cfg.preset !== "ring"} marginTop={0}>
            <SliderField
              id="ad-widget-radius"
              label="Corner radius"
              unit="px"
              value={cfg.radius}
              min={AD_WIDGET_LIMITS.radius.min}
              max={AD_WIDGET_LIMITS.radius.max}
              onChange={(radius) => patchConfig({ radius })}
            />
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Font">
        <div className="space-y-4">
          <GoogleFontSelect id="ad-widget-font-family" value={cfg.fontFamily} onValueChange={(fontFamily) => patchConfig({ fontFamily })} />
          <FontWeightSelect
            id="ad-widget-font-weight"
            triggerClassName="w-full"
            value={cfg.fontWeight}
            onValueChange={(fontWeight) => patchConfig({ fontWeight })}
          />
          <SliderField
            id="ad-widget-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={AD_WIDGET_LIMITS.fontSize.min}
            max={AD_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />
          <SwitchField
            id="ad-widget-text-shadow"
            label="Text shadow"
            hint="Keeps the text readable over bright game footage."
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Motion">
        <div className="grid grid-cols-2 gap-2">
          <OptionSelect
            id="ad-widget-animation-in"
            label="Appears"
            value={cfg.animationIn}
            options={AD_WIDGET_ANIMATIONS_IN}
            labels={GOAL_WIDGET_ANIMATION_LABELS}
            onChange={(animationIn) => patchConfig({ animationIn })}
          />
          <OptionSelect
            id="ad-widget-animation-out"
            label="Hides"
            value={cfg.animationOut}
            options={AD_WIDGET_ANIMATIONS_OUT}
            labels={GOAL_WIDGET_ANIMATION_LABELS}
            onChange={(animationOut) => patchConfig({ animationOut })}
          />
        </div>
      </InspectorSection>
    </div>
  );
}
