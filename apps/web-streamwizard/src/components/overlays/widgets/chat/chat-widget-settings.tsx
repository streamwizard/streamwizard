"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
  Columns3,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  Rows3,
} from "lucide-react";
import { useDemoFire } from "@/hooks/overlays/use-demo-fire";
import {
  Button,
  cn,
  ColorPicker,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import {
  CHAT_WIDGET_HORIZONTAL_MIN_WIDTH,
  CHAT_WIDGET_VERTICAL_SIZE,
  chatWidgetHorizontalHeight,
  getDesignSize,
  getItemScale,
  hasCrop,
  CHAT_WIDGET_ANIMATIONS_IN,
  CHAT_WIDGET_ANIMATIONS_OUT,
  CHAT_WIDGET_ANIMATION_LABELS,
  CHAT_WIDGET_EMOTE_PROVIDERS,
  CHAT_WIDGET_EMOTE_PROVIDER_LABELS,
  CHAT_WIDGET_LIMITS,
  CHAT_WIDGET_NOTICE_KINDS,
  CHAT_WIDGET_NOTICE_LABELS,
  CHAT_WIDGET_PRESETS,
  CHAT_WIDGET_PRESET_LABELS,
  createDefaultChatWidgetConfig,
  normalizeChatWidgetConfig,
  normalizeChatWidgetHiddenUsers,
  type ChatWidgetAnimationIn,
  type ChatWidgetAnimationOut,
  type ChatWidgetDirection,
  type ChatWidgetLayout,
  type ChatWidgetItemConfig,
  type ChatWidgetNameColorMode,
  type ChatWidgetPreset,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  GroupLabel,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  SegmentedField,
  SliderField,
  SwitchField,
  type SegmentedOption,
} from "@/components/overlays/inspector-fields";
import type { OverlayItem } from "@/types/overlays";
import type { OverlayInspectorAppendProps } from "../../registry/overlay-widget-registry.types";

/** The settings that decide how tall one horizontal row is. */
const HORIZONTAL_HEIGHT_KEYS = ["layout", "preset", "fontSize", "padding"] as const;

/**
 * The box to switch to for a layout. Horizontal hugs one row so the strip
 * doesn't float in the middle of a tall box; vertical goes back to the default
 * column. The bottom edge stays put either way, since chat reads from the
 * bottom. Returns null when nothing should move: a cropped widget (its box is
 * the crop's business) or a box that already fits.
 */
function chatBoxGeometry(
  item: OverlayItem,
  next: ChatWidgetItemConfig,
  previous: ChatWidgetItemConfig,
): Partial<OverlayItem> | null {
  if (hasCrop(item)) return null;
  const design = getDesignSize(item);
  const scale = getItemScale(item);

  let target: { w: number; h: number };
  if (next.layout === "horizontal") {
    target = {
      w: Math.max(design.w, CHAT_WIDGET_HORIZONTAL_MIN_WIDTH),
      h: chatWidgetHorizontalHeight(next),
    };
  } else if (previous.layout === "horizontal") {
    target = { ...CHAT_WIDGET_VERTICAL_SIZE };
  } else {
    return null;
  }
  if (target.w === design.w && target.h === design.h) return null;

  const grow = (design.h - target.h) * scale;
  const shift = item.anchor_y === "top" ? grow : item.anchor_y === "center" ? grow / 2 : 0;
  const y = Math.round(item.y + shift);
  return {
    design_w: target.w,
    design_h: target.h,
    w: Math.round(target.w * scale),
    h: Math.round(target.h * scale),
    // Growing back to a column near the top of the scene would push it off
    // the top edge; stop at the edge instead.
    y: item.anchor_y === "top" ? Math.max(0, y) : y,
  };
}

function AnimationSelect<T extends string>({
  id,
  label,
  value,
  options,
  hint,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: T;
  options: readonly T[];
  hint?: ReactNode;
  disabled?: boolean;
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
      <Select value={value} onValueChange={(v) => onChange(v as T)} disabled={disabled}>
        <SelectTrigger id={id} size="sm" className="w-full text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option} className="text-xs">
              {CHAT_WIDGET_ANIMATION_LABELS[option as keyof typeof CHAT_WIDGET_ANIMATION_LABELS]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/** A two-line sketch of each preset, so the choice reads before the label does. */
function PresetSketch({ preset }: { preset: ChatWidgetPreset }) {
  const name = "h-1 w-3 shrink-0 rounded-full bg-primary/70";
  const text = "h-1 rounded-full bg-muted-foreground/50";

  if (preset === "card") {
    return (
      <div className="flex w-full flex-col gap-1">
        {[8, 6].map((w) => (
          <div key={w} className="flex flex-col gap-0.5 rounded-sm bg-muted-foreground/15 p-1">
            <div className={name} />
            <div className={text} style={{ width: `${w * 4}px` }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {[7, 5].map((w) => (
        <div
          key={w}
          className={cn(
            "flex w-fit max-w-full items-center gap-1",
            preset === "bubbles" && "rounded-full bg-muted-foreground/15 px-1.5 py-1",
            preset === "plain" && "py-1",
          )}
        >
          <div className={name} />
          <div className={text} style={{ width: `${w * 4}px` }} />
        </div>
      ))}
    </div>
  );
}

const NAME_COLOR_OPTIONS: readonly SegmentedOption<ChatWidgetNameColorMode>[] = [
  { value: "user", label: "Twitch colors" },
  { value: "fixed", label: "Custom" },
];

const LAYOUT_OPTIONS: readonly SegmentedOption<ChatWidgetLayout>[] = [
  { value: "vertical", label: "Vertical", icon: Rows3 },
  { value: "horizontal", label: "Horizontal", icon: Columns3 },
];

const DIRECTION_OPTIONS_VERTICAL: readonly SegmentedOption<ChatWidgetDirection>[] = [
  { value: "bottom_up", label: "At the bottom", icon: ArrowDownToLine },
  { value: "top_down", label: "At the top", icon: ArrowUpToLine },
];

const DIRECTION_OPTIONS_HORIZONTAL: readonly SegmentedOption<ChatWidgetDirection>[] = [
  { value: "top_down", label: "On the left", icon: ArrowLeftToLine },
  { value: "bottom_up", label: "On the right", icon: ArrowRightToLine },
];

function formatHiddenUsers(users: string[]) {
  return users.join("\n");
}


/** Space between stacked fields; revealed blocks animate in from the same gap. */
const FIELD_GAP = 16;
/** Seconds a newly switched-on fade starts at when there's nothing to go back to. */
const DEFAULT_FADE_SECONDS = 30;
const FADE_SLIDER_MAX = 120;

export function ChatWidgetSettings({ item, updateItem }: OverlayInspectorAppendProps) {
  const cfg = normalizeChatWidgetConfig(item.config);
  const { fire } = useDemoFire();
  const [testBusy, setTestBusy] = useState(false);

  // Edited as free text and only normalised on blur, so typing a login isn't
  // fought character by character.
  const [hiddenDraft, setHiddenDraft] = useState(() => formatHiddenUsers(cfg.hiddenUsers));
  const hiddenKey = cfg.hiddenUsers.join(",");
  useEffect(() => {
    setHiddenDraft(formatHiddenUsers(hiddenKey ? hiddenKey.split(",") : []));
  }, [item.id, hiddenKey]);

  // Switching fade off stores 0, so remember the last real value to switch
  // back on to.
  const lastFade = useRef(cfg.fadeAfterSeconds || DEFAULT_FADE_SECONDS);
  useEffect(() => {
    if (cfg.fadeAfterSeconds > 0) lastFade.current = cfg.fadeAfterSeconds;
  }, [cfg.fadeAfterSeconds]);

  function patchConfig(updates: Partial<ChatWidgetItemConfig>) {
    const next = { ...cfg, ...updates };
    const refit =
      (next.layout === "horizontal" || updates.layout === "vertical") &&
      HORIZONTAL_HEIGHT_KEYS.some((key) => key in updates && updates[key] !== cfg[key]);
    const geometry = refit ? chatBoxGeometry(item, next, cfg) : null;
    // One update, so undo takes the layout and the resize back together.
    updateItem(item.id, { config: next, ...geometry });
  }

  function commitHiddenUsers() {
    const hiddenUsers = normalizeChatWidgetHiddenUsers(hiddenDraft.split(/[\s,]+/));
    setHiddenDraft(formatHiddenUsers(hiddenUsers));
    if (hiddenUsers.join(",") !== hiddenKey) patchConfig({ hiddenUsers });
  }

  async function sendTest() {
    // Same path as the demo bar, so its Local/Live switch applies here too.
    setTestBusy(true);
    try {
      await fire({ type: "channel.chat.message" });
    } finally {
      setTestBusy(false);
    }
  }

  const framed = cfg.preset !== "plain";
  const horizontal = cfg.layout === "horizontal";
  const fading = cfg.fadeAfterSeconds > 0;
  const enabledProviders = CHAT_WIDGET_EMOTE_PROVIDERS.filter((p) => cfg.emoteProviders[p]);

  return (
    <div className="space-y-6">
      <Button variant="outline" size="sm" className="w-full" onClick={sendTest} disabled={testBusy}>
        {testBusy ? <Loader2 className="animate-spin" /> : <MessageSquarePlus />}
        Send a test message
      </Button>

      <InspectorSection title="Style" defaultOpen>
        <div className="space-y-4">
          <ToggleGroup
            type="single"
            value={cfg.preset}
            onValueChange={(v) => v && patchConfig({ preset: v as ChatWidgetPreset })}
            spacing={2}
            aria-label="Style"
            className="grid w-full grid-cols-3"
          >
            {CHAT_WIDGET_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset}
                value={preset}
                className="h-auto w-full flex-col items-stretch gap-2 border border-input p-2 text-xs font-normal data-[state=on]:border-primary data-[state=on]:bg-primary/10 data-[state=on]:text-foreground"
              >
                <div className="flex h-10 items-center">
                  <PresetSketch preset={preset} />
                </div>
                <span className="text-center">{CHAT_WIDGET_PRESET_LABELS[preset]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <GoogleFontSelect
            id="chat-widget-font-family"
            value={cfg.fontFamily}
            onValueChange={(v) => patchConfig({ fontFamily: v })}
          />

          <div className="grid grid-cols-2 gap-2">
            <FontWeightSelect
              id="chat-widget-font-weight"
              className="min-w-0"
              triggerClassName="w-full"
              value={cfg.fontWeight}
              onValueChange={(fontWeight) => patchConfig({ fontWeight })}
            />
            <div className="min-w-0 space-y-1.5">
              <Label className="text-xs">Text color</Label>
              <ColorPicker
                value={cfg.textColor}
                onChange={(textColor) => patchConfig({ textColor })}
                aria-label="Text color"
              />
            </div>
          </div>

          <SliderField
            id="chat-font-size"
            label="Font size"
            unit="px"
            value={cfg.fontSize}
            min={CHAT_WIDGET_LIMITS.fontSize.min}
            max={CHAT_WIDGET_LIMITS.fontSize.max}
            onChange={(fontSize) => patchConfig({ fontSize })}
          />

          <div>
            <SegmentedField
              id="chat-name-color"
              label="Name color"
              value={cfg.nameColorMode}
              options={NAME_COLOR_OPTIONS}
              hint="Twitch colors uses the color each chatter picked on Twitch."
              onChange={(nameColorMode) => patchConfig({ nameColorMode })}
            />
            <InspectorReveal show={cfg.nameColorMode === "fixed"} marginTop={8}>
              <ColorPicker
                value={cfg.nameColor}
                onChange={(nameColor) => patchConfig({ nameColor })}
                aria-label="Name color"
              />
            </InspectorReveal>
          </div>

          <SwitchField
            id="chat-text-shadow"
            label="Text shadow"
            hint="Keeps text readable over busy or bright gameplay."
            checked={cfg.textShadow}
            onCheckedChange={(textShadow) => patchConfig({ textShadow })}
          />

          <InspectorReveal show={framed} marginTop={FIELD_GAP}>
            <div className="space-y-4 border-t pt-4">
              <GroupLabel>Background</GroupLabel>
              <div className="space-y-1.5">
                <Label className="text-xs">Color</Label>
                <ColorPicker
                  value={cfg.backgroundColor}
                  onChange={(backgroundColor) => patchConfig({ backgroundColor })}
                  aria-label="Message background color"
                />
              </div>
              <SliderField
                id="chat-bg-opacity"
                label="Opacity"
                unit="%"
                value={Math.round(cfg.backgroundOpacity * 100)}
                min={0}
                max={100}
                onChange={(v) => patchConfig({ backgroundOpacity: v / 100 })}
              />
              <SliderField
                id="chat-radius"
                label="Corner radius"
                unit="px"
                value={cfg.radius}
                min={CHAT_WIDGET_LIMITS.radius.min}
                max={CHAT_WIDGET_LIMITS.radius.max}
                onChange={(radius) => patchConfig({ radius })}
              />
            </div>
          </InspectorReveal>
        </div>
      </InspectorSection>

      <InspectorSection title="Layout" defaultOpen>
        <div className="space-y-4">
          <SegmentedField
            id="chat-layout"
            label="Layout"
            value={cfg.layout}
            options={LAYOUT_OPTIONS}
            hint={
              horizontal
                ? "One line per message, side by side. The box shrinks to one row; set Frame width under Scale & crop to make the strip longer."
                : "A normal chat column. Horizontal puts messages side by side for a ticker along the top or bottom."
            }
            onChange={(layout) => patchConfig({ layout })}
          />

          <SegmentedField
            id="chat-direction"
            label="Newest message"
            value={cfg.direction}
            options={horizontal ? DIRECTION_OPTIONS_HORIZONTAL : DIRECTION_OPTIONS_VERTICAL}
            onChange={(direction) => patchConfig({ direction })}
          />

          <SliderField
            id="chat-max-messages"
            label="Max on screen"
            value={cfg.maxMessages}
            min={CHAT_WIDGET_LIMITS.maxMessages.min}
            max={CHAT_WIDGET_LIMITS.maxMessages.max}
            onChange={(maxMessages) => patchConfig({ maxMessages })}
          />

          <SliderField
            id="chat-gap"
            label="Space between messages"
            unit="px"
            value={cfg.gap}
            min={CHAT_WIDGET_LIMITS.gap.min}
            max={CHAT_WIDGET_LIMITS.gap.max}
            onChange={(gap) => patchConfig({ gap })}
          />

          <SliderField
            id="chat-padding"
            label="Padding"
            unit="px"
            hint="Space between the edge of the box and the messages."
            value={cfg.padding}
            min={CHAT_WIDGET_LIMITS.padding.min}
            max={CHAT_WIDGET_LIMITS.padding.max}
            onChange={(padding) => patchConfig({ padding })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Motion">
        <div className="space-y-4">
          <div>
            <SwitchField
              id="chat-fade"
              label="Fade out old messages"
              hint="When this is off, messages stay up until newer ones push them out."
              checked={fading}
              onCheckedChange={(on) =>
                patchConfig({ fadeAfterSeconds: on ? lastFade.current : 0 })
              }
            />
            <InspectorReveal show={fading} marginTop={12}>
              <SliderField
                id="chat-fade-seconds"
                label="After"
                unit="s"
                value={cfg.fadeAfterSeconds}
                min={1}
                max={FADE_SLIDER_MAX}
                onChange={(fadeAfterSeconds) => patchConfig({ fadeAfterSeconds })}
              />
            </InspectorReveal>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <AnimationSelect
              id="chat-animation-in"
              label="Animate in"
              value={cfg.animationIn}
              options={CHAT_WIDGET_ANIMATIONS_IN}
              onChange={(animationIn: ChatWidgetAnimationIn) => patchConfig({ animationIn })}
            />
            <AnimationSelect
              id="chat-animation-out"
              label="Animate out"
              value={cfg.animationOut}
              options={CHAT_WIDGET_ANIMATIONS_OUT}
              disabled={!fading}
              hint={fading ? "Plays as a message fades out." : "Plays when a message fades out. Turn on Fade out old messages to use it."}
              onChange={(animationOut: ChatWidgetAnimationOut) => patchConfig({ animationOut })}
            />
          </div>

          <SwitchField
            id="chat-animate-move"
            label="Slide messages along"
            hint="Older messages glide to their new spot instead of jumping when a new one arrives."
            checked={cfg.animateMove}
            onCheckedChange={(animateMove) => patchConfig({ animateMove })}
          />
        </div>
      </InspectorSection>

      <InspectorSection title="Content">
        <div className="space-y-4">
          <div className="space-y-1">
            <SwitchField
              id="chat-badges"
              label="Badges"
              checked={cfg.showBadges}
              onCheckedChange={(showBadges) => patchConfig({ showBadges })}
            />
            <SwitchField
              id="chat-avatars"
              label="Profile pictures"
              checked={cfg.showAvatars}
              onCheckedChange={(showAvatars) => patchConfig({ showAvatars })}
            />
            <SwitchField
              id="chat-gifs"
              label="GIFs"
              checked={cfg.showGifs}
              onCheckedChange={(showGifs) => patchConfig({ showGifs })}
              hint="Tier 2 and Tier 3 subs can post GIFs from the GIF keyboard in Twitch chat. Switch this off and those messages stay off the overlay. Turn the keyboard itself on or off in your Creator Dashboard under Monetization, Subscriptions."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label id="chat-emotes-label" className="text-xs">
                Emotes
              </Label>
              <InspectorHint label="About emotes">
                Twitch emotes always show. These add your channel&apos;s third-party sets.
              </InspectorHint>
            </div>
            <ToggleGroup
              type="multiple"
              value={enabledProviders}
              onValueChange={(values) =>
                patchConfig({
                  emoteProviders: Object.fromEntries(
                    CHAT_WIDGET_EMOTE_PROVIDERS.map((p) => [p, values.includes(p)]),
                  ) as ChatWidgetItemConfig["emoteProviders"],
                })
              }
              variant="outline"
              size="sm"
              aria-labelledby="chat-emotes-label"
              className="w-full"
            >
              {CHAT_WIDGET_EMOTE_PROVIDERS.map((provider) => (
                <ToggleGroupItem key={provider} value={provider} className="flex-1 shrink text-xs">
                  {CHAT_WIDGET_EMOTE_PROVIDER_LABELS[provider]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="space-y-1 border-t pt-4">
            <GroupLabel>Subs, raids &amp; announcements</GroupLabel>
            {CHAT_WIDGET_NOTICE_KINDS.map((kind) => (
              <SwitchField
                key={kind}
                id={`chat-notice-${kind}`}
                label={CHAT_WIDGET_NOTICE_LABELS[kind]}
                checked={cfg.notices[kind]}
                onCheckedChange={(v) => patchConfig({ notices: { ...cfg.notices, [kind]: v } })}
              />
            ))}
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Filters">
        <div className="space-y-4">
          <SwitchField
            id="chat-hide-commands"
            label="Hide !commands"
            hint="Skips messages that start with !, like !discord or !uptime."
            checked={cfg.hideCommands}
            onCheckedChange={(hideCommands) => patchConfig({ hideCommands })}
          />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Label htmlFor="chat-hidden-users" className="text-xs">
                  Hidden accounts
                </Label>
                <InspectorHint label="About hidden accounts">
                  One Twitch username per line. Common bots are in here already.
                </InspectorHint>
              </div>
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {cfg.hiddenUsers.length}
              </span>
            </div>
            <Textarea
              id="chat-hidden-users"
              value={hiddenDraft}
              onChange={(e) => setHiddenDraft(e.target.value)}
              onBlur={commitHiddenUsers}
              rows={5}
              className="resize-y font-mono text-xs"
              placeholder={"nightbot\nstreamelements"}
            />
          </div>
        </div>
      </InspectorSection>

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-muted-foreground"
        onClick={() => patchConfig(createDefaultChatWidgetConfig())}
      >
        <RotateCcw />
        Reset to defaults
      </Button>
    </div>
  );
}
