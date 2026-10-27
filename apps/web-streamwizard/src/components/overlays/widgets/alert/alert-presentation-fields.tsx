"use client";

import { useRef, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  cn,
  ColorPicker,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@repo/ui";
import {
  ALERT_ENTER_ANIMATIONS,
  ALERT_EXIT_ANIMATIONS,
  ALERT_HIGHLIGHT_ANIMATIONS,
  ALERT_TYPOGRAPHY_LIMITS,
  ALERT_CUSTOM_CSS_MAX_LENGTH,
  type AlertEventType,
  type AlertHighlightAnimation,
  type AlertPresentation,
} from "@repo/ui/overlay";
import {
  FontWeightSelect,
  GoogleFontSelect,
  GroupLabel,
  InspectorHint,
  InspectorReveal,
  InspectorSection,
  MediaCardField,
  SliderField,
  SwitchField,
  TextAlignSelect,
} from "@/components/overlays/inspector-fields";
import { AlertTokenChips } from "./alert-token-chips";
import { AlertLayoutPicker } from "./alert-layout-picker";
import { AlertEffectField, AlertEffectPreview } from "./alert-effect-field";
import { alertEffectLabel } from "./alert-widget-labels";

/**
 * The parts of a presentation that fold. Each sits with the thing it changes:
 * how the text looks is under the text, where the media sits is under the
 * media.
 */
export type AlertFieldGroup =
  | "text"
  | "typography"
  | "media"
  | "timing"
  | "animation"
  | "textAnimation"
  | "css";

/** Matches the limit `normalizeAlertWidgetConfig` holds a template to. */
const TEMPLATE_MAX_LENGTH = 200;

export interface AlertPresentationFieldsProps {
  /** Decides which tokens the text fields offer. */
  event: AlertEventType;
  value: AlertPresentation;
  /** 0–1, so the sound preview plays as loud as the alert will. */
  masterVolume: number;
  /** Owned by the panel, so a group opened in one place is still open in the next. */
  openGroups: Record<AlertFieldGroup, boolean>;
  onOpenGroupChange: (group: AlertFieldGroup, open: boolean) => void;
  onPatch: (updates: Partial<AlertPresentation>) => void;
  /** Extra rows at the end of Timing: the alert's own minimum, which a variation has no use for. */
  timingExtra?: ReactNode;
}

function TemplateField({
  id,
  label,
  event,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  event: AlertEventType;
  value: string;
  placeholder?: string;
  onChange: (next: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 text-sm"
        maxLength={TEMPLATE_MAX_LENGTH}
        placeholder={placeholder}
      />
      <AlertTokenChips
        event={event}
        text={value}
        inputRef={inputRef}
        maxLength={TEMPLATE_MAX_LENGTH}
        onChange={onChange}
      />
    </div>
  );
}

/**
 * A fold inside a group, for the settings most people set once: a bordered row
 * that says what is behind it and what it is set to now, so the answer is
 * often readable without opening it.
 */
function FoldRow({
  title,
  summary,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  summary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ChevronRight
          className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
        />
        <span className="shrink-0 text-sm font-medium">{title}</span>
        <span className="ml-auto min-w-0 truncate text-xs text-muted-foreground">{summary}</span>
      </button>
      <InspectorReveal show={open}>
        <div className="space-y-4 border-t px-3 pb-4 pt-3">{children}</div>
      </InspectorReveal>
    </div>
  );
}

function ColorRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex min-w-0 items-center gap-1">
        <Label className="truncate text-xs">{label} color</Label>
        {hint ? <InspectorHint label={`About the ${label.toLowerCase()} color`}>{hint}</InspectorHint> : null}
      </div>
      {children}
    </div>
  );
}

/** What the text's own motion is set to, for its closed row. */
function textMotionSummary(p: AlertPresentation): string {
  const moves = p.textAnimationIn !== "none" || p.textAnimationOut !== "none";
  const timed = p.textDelaySeconds > 0 || p.textEarlyExitSeconds > 0;
  if (!moves && !timed) return "Off";
  if (p.textAnimationIn !== "none") return alertEffectLabel(p.textAnimationIn);
  if (p.textAnimationOut !== "none") return alertEffectLabel(p.textAnimationOut);
  return "Timed";
}

/**
 * How an alert looks, sounds and moves, as four groups of fields. The alert
 * for an event and each of its variations are edited with this same set, so a
 * variation can change anything the alert can.
 */
export function AlertPresentationFields({
  event,
  value,
  masterVolume,
  openGroups,
  onOpenGroupChange,
  onPatch,
  timingExtra,
}: AlertPresentationFieldsProps) {
  // A leftover "media" mode on an image or an empty slot has no video to match,
  // so it reads (and behaves) as the fixed one.
  const bothAudible =
    value.mediaKind === "video" &&
    Boolean(value.soundUrl) &&
    value.volume > 0 &&
    value.videoVolume > 0;
  const matchesVideo = value.mediaKind === "video" && value.durationMode === "media";

  const group = (id: AlertFieldGroup) => ({
    open: openGroups[id],
    onOpenChange: (open: boolean) => onOpenGroupChange(id, open),
  });

  return (
    <>
      <InspectorSection title="Text" {...group("text")}>
        <div className="space-y-4">
          <TemplateField
            id={`alert-title-${event}`}
            label="Title"
            event={event}
            value={value.titleTemplate}
            onChange={(titleTemplate) => onPatch({ titleTemplate })}
          />
          <TemplateField
            id={`alert-second-line-${event}`}
            label="Second line"
            event={event}
            value={value.messageTemplate}
            placeholder="Leave empty to hide"
            onChange={(messageTemplate) => onPatch({ messageTemplate })}
          />

          <FoldRow
            title="Typography"
            summary={`${value.fontFamily}, ${value.fontSize}px`}
            {...group("typography")}
          >
            <GoogleFontSelect
              id={`alert-font-family-${event}`}
              value={value.fontFamily}
              onValueChange={(fontFamily) => onPatch({ fontFamily })}
            />

            <SliderField
              id={`alert-font-size-${event}`}
              label="Font size"
              unit="px"
              value={value.fontSize}
              min={12}
              max={96}
              onChange={(v) => onPatch({ fontSize: Math.round(v) })}
            />

            <div className="grid grid-cols-2 gap-2">
              <FontWeightSelect
                id={`alert-font-weight-${event}`}
                className="min-w-0"
                triggerClassName="w-full"
                value={value.fontWeight}
                onValueChange={(fontWeight) => onPatch({ fontWeight })}
              />
              <TextAlignSelect
                id={`alert-align-${event}`}
                className="min-w-0"
                triggerClassName="w-full"
                value={value.align}
                onValueChange={(align) => onPatch({ align })}
              />
            </div>

            {/* One per row, name on the left: three across left no room
                for the color's own value. */}
            <div className="space-y-2">
              <ColorRow label="Title">
                <ColorPicker
                  className="w-28"
                  value={value.titleColor}
                  onChange={(titleColor) => onPatch({ titleColor })}
                  aria-label="Title color"
                />
              </ColorRow>
              <ColorRow
                label="Accent"
                hint={
                  <>
                    Colors {"{name}"} and {"{amount}"} in the title.
                  </>
                }
              >
                <ColorPicker
                  className="w-28"
                  value={value.accentColor}
                  fallback="#9e7aff"
                  onChange={(accentColor) => onPatch({ accentColor })}
                  aria-label="Accent color"
                />
              </ColorRow>
              <ColorRow label="Second line">
                <ColorPicker
                  className="w-28"
                  value={value.messageColor}
                  fallback="#d4d4d8"
                  onChange={(messageColor) => onPatch({ messageColor })}
                  aria-label="Second line color"
                />
              </ColorRow>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-1">
                <Label id={`alert-highlight-${event}-label`} className="text-xs">
                  Highlight animation
                </Label>
                <InspectorHint label="About the highlight animation">
                  What {"{name}"} and {"{amount}"} keep doing in the title for as long as it shows.
                </InspectorHint>
              </div>
              <div className="flex items-center gap-2">
                <AlertEffectPreview effect={value.highlightAnimation} seconds={1} loop />
                <Select
                  value={value.highlightAnimation}
                  onValueChange={(v) =>
                    onPatch({ highlightAnimation: v as AlertHighlightAnimation })
                  }
                >
                  <SelectTrigger
                    aria-labelledby={`alert-highlight-${event}-label`}
                    className="h-9 min-w-0 flex-1 text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_HIGHLIGHT_ANIMATIONS.map((effect) => (
                      <SelectItem key={effect} value={effect} className="text-sm">
                        {alertEffectLabel(effect)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <SwitchField
              id={`alert-text-shadow-${event}`}
              label="Text shadow"
              checked={value.textShadow}
              hint="A soft shadow behind the text, so it stays readable over a busy game."
              onCheckedChange={(textShadow) => onPatch({ textShadow })}
            />

            <GroupLabel>Spacing</GroupLabel>
            <SliderField
              id={`alert-line-height-${event}`}
              label="Line height"
              unit="%"
              value={Math.round(value.lineHeight * 100)}
              min={ALERT_TYPOGRAPHY_LIMITS.lineHeight.min * 100}
              max={ALERT_TYPOGRAPHY_LIMITS.lineHeight.max * 100}
              step={5}
              hint="Room between the lines of a title that wraps. The second line follows it."
              onChange={(v) => onPatch({ lineHeight: v / 100 })}
            />
            <SliderField
              id={`alert-letter-spacing-${event}`}
              label="Letter spacing"
              unit="px"
              value={value.letterSpacing}
              min={ALERT_TYPOGRAPHY_LIMITS.letterSpacing.min}
              max={ALERT_TYPOGRAPHY_LIMITS.letterSpacing.max}
              step={0.5}
              onChange={(letterSpacing) => onPatch({ letterSpacing })}
            />
            <SliderField
              id={`alert-word-spacing-${event}`}
              label="Word spacing"
              unit="px"
              value={value.wordSpacing}
              min={ALERT_TYPOGRAPHY_LIMITS.wordSpacing.min}
              max={ALERT_TYPOGRAPHY_LIMITS.wordSpacing.max}
              onChange={(wordSpacing) => onPatch({ wordSpacing })}
            />
            <SliderField
              id={`alert-message-scale-${event}`}
              label="Second line size"
              unit="%"
              value={Math.round(value.messageFontScale * 100)}
              min={ALERT_TYPOGRAPHY_LIMITS.messageFontScale.min * 100}
              max={ALERT_TYPOGRAPHY_LIMITS.messageFontScale.max * 100}
              step={5}
              hint="How big the second line is next to the title."
              onChange={(v) => onPatch({ messageFontScale: v / 100 })}
            />
          </FoldRow>
        </div>
      </InspectorSection>

      <InspectorSection title="Media and sound" {...group("media")}>
        <div className="space-y-4">
          <MediaCardField
            label="Image or video"
            kinds={["image", "video"]}
            value={value.mediaUrl}
            mediaKind={value.mediaKind}
            emptyTitle="Add an image or video"
            emptyHint="PNG, GIF or transparent WebM."
            onChange={(url, kind) =>
              onPatch({
                mediaUrl: url,
                mediaKind: kind === "video" ? "video" : kind === "image" ? "image" : "",
              })
            }
          />
          {/* Where it sits only means something once there is one. */}
          <InspectorReveal show={Boolean(value.mediaUrl)}>
            <AlertLayoutPicker
              id={`alert-layout-${event}`}
              value={value.layout}
              onChange={(layout) => onPatch({ layout })}
            />
          </InspectorReveal>

          <MediaCardField
            label="Sound"
            kinds={["audio"]}
            value={value.soundUrl}
            emptyTitle="Add a sound"
            emptyHint="Plays when the alert shows."
            previewVolume={value.volume * masterVolume}
            onChange={(soundUrl) => onPatch({ soundUrl })}
          />
          <InspectorReveal show={Boolean(value.soundUrl)}>
            <SliderField
              id={`alert-volume-${event}`}
              label="Sound volume"
              unit="%"
              value={Math.round(value.volume * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => onPatch({ volume: v / 100 })}
            />
          </InspectorReveal>
          <InspectorReveal show={value.mediaKind === "video"}>
            <SliderField
              id={`alert-video-volume-${event}`}
              label="Video sound"
              unit="%"
              value={Math.round(value.videoVolume * 100)}
              min={0}
              max={100}
              step={5}
              hint="The video's own audio. Set it to 0 to play the video silently."
              onChange={(v) => onPatch({ videoVolume: v / 100 })}
            />
          </InspectorReveal>
          {bothAudible ? (
            <p className="text-xs leading-snug text-muted-foreground">
              The video&apos;s sound and the sound file play together. Turn one down if
              that&apos;s too much.
            </p>
          ) : null}
        </div>
      </InspectorSection>

      <InspectorSection title="Timing" {...group("timing")}>
        <div className="space-y-4">
          <SliderField
            id={`alert-duration-${event}`}
            label="On screen"
            unit="s"
            value={value.durationSeconds}
            min={1}
            max={30}
            disabled={matchesVideo}
            onChange={(v) => onPatch({ durationSeconds: Math.round(v) })}
          />
          {value.mediaKind === "video" && (
            <SwitchField
              id={`alert-duration-mode-${event}`}
              label="Match the video length"
              checked={matchesVideo}
              hint="Plays the video once and leaves when it ends, instead of looping for a set time. Long videos get cut at 60s."
              onCheckedChange={(v) => onPatch({ durationMode: v ? "media" : "fixed" })}
            />
          )}
          {timingExtra}
        </div>
      </InspectorSection>

      <InspectorSection title="Animation" {...group("animation")}>
        <div className="space-y-4">
          <AlertEffectField
            id={`alert-enter-${event}`}
            label="Enter"
            hint="How the whole alert comes on, image or video and text together. Its time counts as part of the time on screen."
            effects={ALERT_ENTER_ANIMATIONS}
            value={value.animationIn}
            seconds={value.animationInSeconds}
            onChange={({ effect, seconds }) =>
              onPatch({ animationIn: effect, animationInSeconds: seconds })
            }
          />
          <AlertEffectField
            id={`alert-exit-${event}`}
            label="Exit"
            hint="How the whole alert leaves. Its time comes on top of the time on screen: 10 seconds with a 1 second exit is 11."
            effects={ALERT_EXIT_ANIMATIONS}
            value={value.animationOut}
            seconds={value.animationOutSeconds}
            onChange={({ effect, seconds }) =>
              onPatch({ animationOut: effect, animationOutSeconds: seconds })
            }
          />

          <FoldRow
            title="Text animation"
            summary={textMotionSummary(value)}
            {...group("textAnimation")}
          >
            <AlertEffectField
              id={`alert-text-enter-${event}`}
              label="Text enter"
              effects={ALERT_ENTER_ANIMATIONS}
              value={value.textAnimationIn}
              seconds={value.textAnimationInSeconds}
              onChange={({ effect, seconds }) =>
                onPatch({ textAnimationIn: effect, textAnimationInSeconds: seconds })
              }
            />
            <AlertEffectField
              id={`alert-text-exit-${event}`}
              label="Text exit"
              effects={ALERT_EXIT_ANIMATIONS}
              value={value.textAnimationOut}
              seconds={value.textAnimationOutSeconds}
              onChange={({ effect, seconds }) =>
                onPatch({ textAnimationOut: effect, textAnimationOutSeconds: seconds })
              }
            />
            <SliderField
              id={`alert-text-delay-${event}`}
              label="Show text after"
              unit="s"
              value={value.textDelaySeconds}
              min={0}
              max={10}
              step={0.1}
              hint="How many seconds to wait before the text shows."
              onChange={(v) => onPatch({ textDelaySeconds: Math.round(v * 10) / 10 })}
            />
            <SliderField
              id={`alert-text-early-${event}`}
              label="Hide text early"
              unit="s"
              value={value.textEarlyExitSeconds}
              min={0}
              max={10}
              step={0.1}
              hint="Takes the text off this many seconds before the alert itself leaves."
              onChange={(v) => onPatch({ textEarlyExitSeconds: Math.round(v * 10) / 10 })}
            />
          </FoldRow>
        </div>
      </InspectorSection>

      <InspectorSection title="Custom CSS" {...group("css")}>
        <div className="space-y-1.5">
          <Label htmlFor={`alert-css-${event}`} className="sr-only">
            Custom CSS
          </Label>
          <Textarea
            id={`alert-css-${event}`}
            value={value.customCss}
            onChange={(e) => onPatch({ customCss: e.target.value })}
            maxLength={ALERT_CUSTOM_CSS_MAX_LENGTH}
            spellCheck={false}
            rows={6}
            placeholder={'[data-part="title"] {\n  -webkit-text-stroke: 2px #000;\n}'}
            className="min-h-28 font-mono text-xs"
          />
          <p className="text-xs leading-snug text-muted-foreground">
            Styles only this alert. Target <code>[data-part=&quot;title&quot;]</code>,{" "}
            <code>message</code>, <code>name</code>, <code>amount</code>, <code>media</code>,{" "}
            <code>text</code> or <code>box</code>. <code>:root</code> is the whole alert.
          </p>
        </div>
      </InspectorSection>
    </>
  );
}
