"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Play, RotateCcw, Square } from "lucide-react";
import {
  DEMO_EVENTS,
  buildDemoCreditsData,
  buildDemoEvent,
  type DemoEventType,
} from "@repo/schemas";
import {
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  ALERT_EVENT_SUBSCRIPTION_TYPES,
  AD_SCHEDULE_TEST_BROWSER_EVENT,
  type AdScheduleTestBrowserEventDetail,
  CREDITS_RESET_BROWSER_EVENT,
  CREDITS_ROLL_BROWSER_EVENT,
  type CreditsResetBrowserEventDetail,
  type CreditsRollBrowserEventDetail,
  WIDGET_SIMULATORS,
  type AlertEventCategoryId,
} from "@repo/ui/overlay";
import {
  Button,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@repo/ui";
import { cn } from "@/lib/utils";
import type { FireMode } from "./demo-fire";
import { MIN_LIVE_INTERVAL_MS, type DemoPanel } from "./use-demo-panel";

/**
 * The bar's quick buttons, derived from the alert box rather than hand-picked,
 * so the two panels can't drift. It matters which event each one fires: the
 * alert widget treats `channel.chat.notification` as the single source for the
 * dozen notices and ignores `channel.subscribe`/`channel.raid` outright, so a
 * hand-written "Sub" button pointed at `channel.subscribe` looks right and does
 * nothing. `ALERT_EVENT_SUBSCRIPTION_TYPES` already holds the correct
 * type+variant pair for all 23, and its `type` is a `WidgetTestEventType`,
 * a subset of `DemoEventType`.
 *
 * The picker still lists the full catalogue -- custom widgets are written
 * against the dedicated subscription types and need them reachable.
 */
const ALERT_BUTTON_GROUPS = ALERT_EVENT_CATEGORIES.map((category) => ({
  id: category.id,
  label: category.label,
  events: category.events.map((event) => {
    const { type, variant } = ALERT_EVENT_SUBSCRIPTION_TYPES[event];
    return {
      type,
      variant,
      label: ALERT_EVENT_LABELS[event],
      // Which listener a custom widget would have to handle. Worth surfacing:
      // half of these are notice types on a shared subscription, which isn't
      // guessable from a button that just says "Gift sub".
      hint: `${type}${variant ? ` · ${variant}` : ""}`,
    };
  }),
}));

/**
 * A poll in four steps: begin, two kinds of vote, and the close. Every step
 * uses the same demo poll id, so they land on one poll in the poll widget
 * (and a poll alert, if the alert box has one set up).
 */
const POLL_STEPS: { label: string; type: DemoEventType; variant?: string; hint: string }[] = [
  { label: "Start", type: "channel.poll.begin", hint: "channel.poll.begin" },
  { label: "Votes", type: "channel.poll.progress", hint: "channel.poll.progress · random votes" },
  { label: "Close race", type: "channel.poll.progress", variant: "close", hint: "channel.poll.progress · close" },
  { label: "End", type: "channel.poll.end", hint: "channel.poll.end" },
];

const quick = "h-7 px-2.5 text-xs";

/** A test button whose tooltip names what it sends, in the form a widget author would listen for. */
function TestButton({
  hint,
  children,
  ...props
}: ComponentProps<typeof Button> & { hint?: ReactNode }) {
  const button = (
    <Button size="sm" variant="outline" className={quick} {...props}>
      {children}
    </Button>
  );
  if (!hint) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-[11px]">
        {hint}
      </TooltipContent>
    </Tooltip>
  );
}

/** A quiet line under a section, for the one thing worth knowing about it. */
function SectionNote({ children }: { children: ReactNode }) {
  return <p className="text-[11px] leading-snug text-muted-foreground">{children}</p>;
}

export function AlertsSection({ panel }: { panel: DemoPanel }) {
  /** Same default and same three groups as the alert inspector's tabs. */
  const [category, setCategory] = useState<AlertEventCategoryId>("community");
  const group = ALERT_BUTTON_GROUPS.find((g) => g.id === category) ?? ALERT_BUTTON_GROUPS[0];

  return (
    <div className="flex flex-col gap-2">
      {/* All 23 at once is a wall, so they sit behind the same three groups the
          alert inspector uses: a streamer who learned the grouping there
          already knows this one. */}
      <ToggleGroup
        type="single"
        value={category}
        // Radix hands back "" when the active item is clicked again; keeping
        // the current group beats emptying the row.
        onValueChange={(v) => v && setCategory(v as AlertEventCategoryId)}
        variant="outline"
        size="sm"
        aria-label="Alert group"
      >
        {ALERT_BUTTON_GROUPS.map((g) => (
          <ToggleGroupItem key={g.id} value={g.id} className="h-7 px-3 text-xs">
            {g.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="flex flex-wrap gap-1.5">
        {group.events.map(({ type, variant, label, hint }) => (
          <TestButton
            key={label}
            hint={hint}
            disabled={panel.isSending}
            aria-label={`Test the ${label} alert`}
            onClick={() => panel.fire(type, variant)}
          >
            {label}
          </TestButton>
        ))}
      </div>
    </div>
  );
}

export function PollSection({ panel }: { panel: DemoPanel }) {
  return (
    <div className="flex flex-col gap-2">
      {/* One connected strip, numbered, because the order is the point: a vote
          before Start has no poll to land on. */}
      <div className="inline-flex w-fit overflow-hidden rounded-md border border-border">
        {POLL_STEPS.map(({ label, type, variant, hint }, i) => (
          <Tooltip key={label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={panel.isSending}
                aria-label={`Test poll: ${label}`}
                onClick={() => panel.fire(type, variant)}
                className={cn(
                  "flex h-7 items-center gap-1.5 px-3 text-xs transition-colors hover:bg-accent disabled:opacity-50",
                  i > 0 && "border-l border-border"
                )}
              >
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
                {label}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono text-[11px]">
              {hint}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      <SectionNote>Every step hits the same poll, so run them in order.</SectionNote>
    </div>
  );
}

export function AdsSection({ panel }: { panel: DemoPanel }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {/* Twitch has no event for an upcoming ad, so this one only reaches the
            ad widgets on this canvas; the ad widget reads the real one from
            Twitch's schedule. */}
        <TestButton
          hint="Ads in 2 minutes, on this canvas only"
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<AdScheduleTestBrowserEventDetail>(AD_SCHEDULE_TEST_BROWSER_EVENT, {
                detail: { sceneId: panel.storageId, nextAdAt: Date.now() + 118_000, duration: 60 },
              })
            )
          }
        >
          Ad coming
        </TestButton>
        {[30, 60].map((seconds) => (
          <TestButton
            key={seconds}
            hint={`channel.ad_break.begin · ${seconds}s`}
            disabled={panel.isSending}
            onClick={() => {
              const { payload } = buildDemoEvent("channel.ad_break.begin");
              panel.fireWith("channel.ad_break.begin", { ...payload, duration_seconds: seconds });
            }}
          >
            {seconds} s break
          </TestButton>
        ))}
      </div>
      <SectionNote>&ldquo;Ad coming&rdquo; only reaches this canvas. Breaks go wherever the mode sends them.</SectionNote>
    </div>
  );
}

export function CreditsSection({ panel }: { panel: DemoPanel }) {
  return (
    <div className="flex flex-col gap-2">
      {/* Credits aren't a Twitch event: the widget rolls when its scene comes
          up. These reach the credits widgets on this canvas only. */}
      <div className="flex flex-wrap gap-1.5">
        <TestButton
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<CreditsRollBrowserEventDetail>(CREDITS_ROLL_BROWSER_EVENT, {
                detail: { sceneId: panel.storageId, data: buildDemoCreditsData() },
              })
            )
          }
        >
          <Play className="size-3" aria-hidden />
          Roll credits
        </TestButton>
        <TestButton
          onClick={() =>
            window.dispatchEvent(
              new CustomEvent<CreditsResetBrowserEventDetail>(CREDITS_RESET_BROWSER_EVENT, {
                detail: { sceneId: panel.storageId },
              })
            )
          }
        >
          <Square className="size-3" aria-hidden />
          Stop
        </TestButton>
      </div>
      <SectionNote>Rolls sample credits on this canvas. Stop goes back to the real stream.</SectionNote>
    </div>
  );
}

/** Looping sources. A one-shot shows what an event looks like; these show what the widget looks like while data keeps arriving. */
export function SimulateSection({
  panel,
  simulatorIds,
}: {
  panel: DemoPanel;
  simulatorIds: string[];
}) {
  const defs = simulatorIds.map((id) => WIDGET_SIMULATORS[id]).filter((d) => d !== undefined);
  const live = panel.effectiveMode === "live";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-1.5">
        {defs.map((def) => {
          const running = panel.runningIds.includes(def.id);
          const tooFastForLive = live && def.defaultIntervalMs < MIN_LIVE_INTERVAL_MS;
          return (
            <TestButton
              key={def.id}
              hint={tooFastForLive && !running ? "Too frequent to send live. Switch to Local." : def.description}
              variant={running ? "secondary" : "outline"}
              aria-pressed={running}
              disabled={tooFastForLive && !running}
              onClick={() => (running ? panel.stopSimulator(def.id) : panel.startSimulator(def.id))}
            >
              {running ? (
                <span className="relative flex size-2" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex size-2 rounded-full bg-primary" />
                </span>
              ) : (
                <Play className="size-3" aria-hidden />
              )}
              {def.label}
              {running && <span className="text-muted-foreground">· Stop</span>}
            </TestButton>
          );
        })}
      </div>
      <SectionNote>
        {panel.runningIds.length > 0 && live
          ? "Running live: every overlay you have open gets these."
          : "Keeps sending until you stop it, even with this panel closed."}
      </SectionNote>
    </div>
  );
}

/** Everything else Twitch sends. The escape hatch: custom widgets are written against the dedicated subscription types and need them reachable. */
export function CustomEventSection({
  panel,
  note,
}: {
  panel: DemoPanel;
  note?: ReactNode;
}) {
  const [payloadOpen, setPayloadOpen] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <Select value={panel.selected} onValueChange={(v) => panel.selectType(v as DemoEventType)}>
          <SelectTrigger size="sm" className="w-[220px] text-xs data-[size=sm]:h-7" aria-label="Event to fire">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {panel.grouped.map(([group, types]) => (
              <SelectGroup key={group}>
                <SelectLabel className="text-[10px]">{group}</SelectLabel>
                {types.map((type) => (
                  <SelectItem key={type} value={type} className="text-xs">
                    {DEMO_EVENTS[type].label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="sm"
          className={quick}
          disabled={panel.isSending}
          onClick={() => panel.fire(panel.selected)}
        >
          Fire
        </Button>

        {panel.variants.map(([key, variant]) => (
          <TestButton
            key={key}
            hint={`${panel.selected} · ${key}`}
            disabled={panel.isSending}
            onClick={() => panel.fire(panel.selected, key)}
          >
            {variant.label}
          </TestButton>
        ))}

        <button
          type="button"
          aria-expanded={payloadOpen}
          onClick={() => setPayloadOpen((v) => !v)}
          className="ml-auto flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {payloadOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          Payload
          {panel.payloadEdited && (
            <span className="rounded bg-primary/15 px-1 text-[10px] leading-4 text-primary">edited</span>
          )}
        </button>
      </div>

      <p className="font-mono text-[11px] text-muted-foreground">{panel.selected}</p>

      {payloadOpen && (
        <div className="flex flex-col gap-1.5">
          <Textarea
            value={panel.payloadText}
            onChange={(e) => panel.editPayload(e.target.value)}
            rows={8}
            spellCheck={false}
            aria-label="Event payload (JSON)"
            className="max-h-56 font-mono text-[11px] leading-relaxed"
          />
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              disabled={!panel.payloadEdited}
              onClick={() => panel.selectType(panel.selected)}
            >
              <RotateCcw className="size-3" aria-hidden />
              Reset
            </Button>
            <SectionNote>Edits apply to {DEMO_EVENTS[panel.selected].label} only.</SectionNote>
          </div>
        </div>
      )}

      {note && <SectionNote>{note}</SectionNote>}
    </div>
  );
}

/** Local/Live, as one segmented control. Null when the host owns the switch itself. */
export function FireModeSwitch({ panel, className }: { panel: DemoPanel; className?: string }) {
  const { changeMode, effectiveMode, liveAvailable } = panel;
  if (!changeMode) return null;

  // The mode governs every test event in the editor, the alert box's own Test
  // buttons included. Local posts straight into the canvas previews; Live goes
  // out over ws-server, which the canvas listens to as well, so the preview
  // and every open overlay show the same event from one delivery.
  return (
    <ToggleGroup
      type="single"
      value={effectiveMode}
      onValueChange={(v) => v && changeMode(v as FireMode)}
      variant="outline"
      size="sm"
      aria-label="Where test events go"
      className={className}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem value="local" className="h-7 px-2.5 text-xs">
            Local
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent side="top">This canvas only</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <ToggleGroupItem
            value="live"
            disabled={!liveAvailable}
            className="h-7 px-2.5 text-xs data-[state=on]:text-primary"
          >
            Live
          </ToggleGroupItem>
        </TooltipTrigger>
        <TooltipContent side="top">
          {liveAvailable
            ? "Through the overlay server: this canvas and every overlay you have open"
            : "Connect to live events first. Live sends through the overlay server."}
        </TooltipContent>
      </Tooltip>
    </ToggleGroup>
  );
}
