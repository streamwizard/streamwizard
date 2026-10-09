"use client";

import { useEffect } from "react";
import { ChevronRight, Film, ImageIcon, Volume2 } from "lucide-react";
import {
  Button,
  cn,
  Separator,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@repo/ui";
import {
  ALERT_EVENT_CATEGORIES,
  ALERT_EVENT_LABELS,
  type AlertEventCategoryId,
  type AlertEventType,
  type AlertVariantConfig,
  type AlertWidgetItemConfig,
} from "@repo/ui/overlay";
import {
  InspectorSection,
  SectionTitle,
  SliderField,
  SwitchField,
} from "@/components/overlays/inspector-fields";
import type { FireMode } from "@/components/demo/demo-fire";

export interface AlertListProps {
  /** Scopes the row ids, so two alert boxes never share one. */
  itemId: string;
  cfg: AlertWidgetItemConfig;
  category: AlertEventCategoryId;
  onCategoryChange: (category: AlertEventCategoryId) => void;
  /** The alert just left: its row takes focus back, so the list resumes where it was. */
  returnTo: AlertEventType | null;
  testBusy: boolean;
  fireMode: FireMode;
  onOpen: (event: AlertEventType) => void;
  onToggle: (event: AlertEventType, enabled: boolean) => void;
  onTest: (event: AlertEventType) => void;
  onPatchConfig: (updates: Partial<AlertWidgetItemConfig>) => void;
}

const rowId = (itemId: string, event: AlertEventType) => `alert-row-${itemId}-${event}`;

/** What a row's two icons say, in words, for the row's own label. */
function mediaSummary(variant: AlertVariantConfig): string {
  const media =
    variant.mediaKind === "video" ? "Video" : variant.mediaKind === "image" ? "Image" : "No image";
  return `${media}, ${variant.soundUrl ? "sound" : "no sound"}`;
}

/**
 * Every alert on one screen: which are on, and which carry media or a sound.
 * A row opens that alert's settings; the switch and Test work from here too.
 */
export function AlertList({
  itemId,
  cfg,
  category,
  onCategoryChange,
  returnTo,
  testBusy,
  fireMode,
  onOpen,
  onToggle,
  onTest,
  onPatchConfig,
}: AlertListProps) {
  useEffect(() => {
    // No scroll with it: the list comes back exactly where it was left.
    if (returnTo) document.getElementById(rowId(itemId, returnTo))?.focus({ preventScroll: true });
    // Only on the way back in: the row to return to is fixed for this mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <SectionTitle>Alerts</SectionTitle>
        <Tabs value={category} onValueChange={(v) => onCategoryChange(v as AlertEventCategoryId)}>
          {/* Same grouping the public /overlays catalog uses, so the page a
              streamer read and the panel they configure line up. */}
          <TabsList className="w-full">
            {ALERT_EVENT_CATEGORIES.map((c) => {
              const on = c.events.filter((e) => cfg.variants[e].enabled).length;
              return (
                <TabsTrigger
                  key={c.id}
                  value={c.id}
                  className="flex-1 gap-1 px-1.5 text-xs"
                  aria-label={`${c.label}, ${on} of ${c.events.length} on`}
                >
                  {c.label}
                  <span className="tabular-nums text-muted-foreground">
                    {on}/{c.events.length}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {ALERT_EVENT_CATEGORIES.map((c) => (
            <TabsContent key={c.id} value={c.id} className="mt-2">
              <ul className="-mx-2">
                {c.events.map((event) => {
                  const variant = cfg.variants[event];
                  const label = ALERT_EVENT_LABELS[event];
                  const MediaIcon = variant.mediaKind === "video" ? Film : ImageIcon;
                  return (
                    <li
                      key={event}
                      className="relative flex min-h-10 items-center gap-2 rounded-md px-2 transition-colors hover:bg-muted/60 has-[[data-open]:focus-visible]:ring-2 has-[[data-open]:focus-visible]:ring-ring"
                    >
                      <Switch
                        aria-label={`${label} alerts`}
                        className="relative z-10"
                        checked={variant.enabled}
                        onCheckedChange={(v) => onToggle(event, v)}
                      />
                      {/* The button's ::after covers the row, so the whole row
                          opens the alert while the switch and Test stay their
                          own controls on top of it. */}
                      <button
                        type="button"
                        id={rowId(itemId, event)}
                        data-open=""
                        title={
                          variant.variations.length
                            ? `${mediaSummary(variant)}, ${variant.variations.length} ${variant.variations.length === 1 ? "variation" : "variations"}`
                            : mediaSummary(variant)
                        }
                        onClick={() => onOpen(event)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none after:absolute after:inset-0"
                      >
                        <span
                          className={cn(
                            "truncate text-sm",
                            !variant.enabled && "text-muted-foreground"
                          )}
                        >
                          {label}
                        </span>
                        {variant.variations.length ? (
                          <span
                            aria-hidden
                            className="shrink-0 rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground"
                          >
                            +{variant.variations.length}
                          </span>
                        ) : null}
                        <span className="sr-only">
                          {variant.enabled ? "On" : "Off"}. {mediaSummary(variant)}.
                          {variant.variations.length
                            ? ` ${variant.variations.length} ${variant.variations.length === 1 ? "variation" : "variations"}.`
                            : ""}{" "}
                          Open settings.
                        </span>
                        <span
                          aria-hidden
                          className={cn(
                            "ml-auto flex shrink-0 items-center gap-1.5",
                            !variant.enabled && "opacity-50"
                          )}
                        >
                          <MediaIcon
                            className={cn(
                              "size-3.5",
                              variant.mediaUrl ? "text-foreground/80" : "text-muted-foreground/30"
                            )}
                          />
                          <Volume2
                            className={cn(
                              "size-3.5",
                              variant.soundUrl ? "text-foreground/80" : "text-muted-foreground/30"
                            )}
                          />
                        </span>
                      </button>
                      {/* Kept in the row while off, just hidden, so the icons
                          line up down the whole list. */}
                      <Button
                        size="xs"
                        variant="ghost"
                        className={cn("relative z-10", !variant.enabled && "invisible")}
                        disabled={testBusy}
                        aria-label={`Test the ${label} alert`}
                        onClick={() => onTest(event)}
                      >
                        Test
                      </Button>
                      <ChevronRight aria-hidden className="size-4 shrink-0 text-muted-foreground" />
                    </li>
                  );
                })}
              </ul>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Separator />

      <InspectorSection title="All alerts" defaultOpen>
        <div className="space-y-4">
          <SliderField
            id={`alert-master-volume-${itemId}`}
            label="Master volume"
            unit="%"
            value={Math.round(cfg.masterVolume * 100)}
            min={0}
            max={100}
            step={5}
            onChange={(v) => onPatchConfig({ masterVolume: v / 100 })}
          />
          <SliderField
            id={`alert-gap-${itemId}`}
            label="Gap between alerts"
            unit="s"
            value={cfg.gapSeconds}
            min={0}
            max={10}
            onChange={(v) => onPatchConfig({ gapSeconds: Math.round(v) })}
          />
          <SliderField
            id={`alert-max-queue-${itemId}`}
            label="Most alerts waiting"
            value={cfg.maxQueue}
            min={5}
            max={200}
            step={5}
            hint="Once this many are lined up, new ones are skipped. Keeps a follow-bot wave from booking your alerts for the next hour."
            onChange={(v) => onPatchConfig({ maxQueue: Math.round(v) })}
          />

          <SwitchField
            id={`alert-wait-for-sound-${itemId}`}
            label="Let sounds finish"
            checked={cfg.waitForSound}
            hint="The next alert waits until this one's sound file has played out, up to a minute. Off, a sound still running is cut when the next alert starts."
            onCheckedChange={(waitForSound) => onPatchConfig({ waitForSound })}
          />

          {/* No live switch here: the demo bar owns it for the whole editor, so
              there is one answer to "where do my tests go" instead of two. */}
          <p className="text-xs leading-snug text-muted-foreground">
            {fireMode === "live"
              ? "Tests play on this canvas and in OBS, exactly like the real thing."
              : "Tests play on this canvas only. Switch the demo bar to Live to fire them in OBS too."}
          </p>
        </div>
      </InspectorSection>
    </div>
  );
}
