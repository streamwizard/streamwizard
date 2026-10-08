"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Label, Separator, Switch } from "@repo/ui";
import {
  ALERT_AMOUNT_LABELS,
  ALERT_EVENT_LABELS,
  type AlertEventType,
  type AlertVariantConfig,
} from "@repo/ui/overlay";
import { InspectorHint, NumberField } from "@/components/overlays/inspector-fields";
import { AlertPresentationFields, type AlertFieldGroup } from "./alert-presentation-fields";

export interface AlertDetailProps {
  event: AlertEventType;
  variant: AlertVariantConfig;
  /** 0–1, so the sound preview plays as loud as the alert will. */
  masterVolume: number;
  /** Owned by the panel, so a group opened on one alert is still open on the next. */
  openGroups: Record<AlertFieldGroup, boolean>;
  onOpenGroupChange: (group: AlertFieldGroup, open: boolean) => void;
  testBusy: boolean;
  /** The alert's variations group, for the alerts that take them. */
  variations?: ReactNode;
  onBack: () => void;
  onPatch: (updates: Partial<AlertVariantConfig>) => void;
  onTest: () => void;
  onCopyLookToAll: () => void;
}

/** One alert's settings, on their own: text, media and sound, timing, animation. */
export function AlertDetail({
  event,
  variant,
  masterVolume,
  openGroups,
  onOpenGroupChange,
  testBusy,
  variations,
  onBack,
  onPatch,
  onTest,
  onCopyLookToAll,
}: AlertDetailProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const label = ALERT_EVENT_LABELS[event];
  const amountLabel = ALERT_AMOUNT_LABELS[event];

  // Focus only: the panel stays scrolled where it was, so opening an alert
  // swaps the list for its settings in place instead of jumping.
  useLayoutEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <div>
      {/* Stays put while the fields scroll under it: the way back, which alert
          this is, its switch and its Test are needed at every depth. */}
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-background px-4 pb-3 pt-1">
        <Button ref={backRef} size="sm" variant="outline" onClick={onBack}>
          <ArrowLeft />
          All alerts
        </Button>
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold" title={label}>
            {label}
          </h3>
          <span className="text-xs text-muted-foreground" aria-hidden>
            {variant.enabled ? "On" : "Off"}
          </span>
          <Switch
            aria-label={`${label} alerts`}
            checked={variant.enabled}
            onCheckedChange={(enabled) => onPatch({ enabled })}
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={testBusy}
            aria-label={`Test the ${label} alert`}
            onClick={onTest}
          >
            Test
          </Button>
        </div>
      </div>

      <div className="space-y-6 pt-5">
        <AlertPresentationFields
          event={event}
          value={variant}
          masterVolume={masterVolume}
          openGroups={openGroups}
          onOpenGroupChange={onOpenGroupChange}
          onPatch={onPatch}
          timingExtra={
            amountLabel ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <Label className="truncate text-xs">Minimum {amountLabel}</Label>
                  <InspectorHint label={`About the minimum ${amountLabel}`}>
                    Alerts below this are skipped, variations included. 0 shows everything.
                  </InspectorHint>
                </div>
                <NumberField
                  value={variant.minAmount}
                  min={0}
                  aria-label={`Minimum ${amountLabel}`}
                  className="h-7 w-20 px-2 text-xs tabular-nums"
                  onCommit={(v) => onPatch({ minAmount: Math.round(v) })}
                />
              </div>
            ) : null
          }
        />

        {variations}

        <Separator />

        {/* Outside the groups: it reaches into three of them, and every other
            alert, so it is not one group's setting. */}
        <div className="space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={onCopyLookToAll}>
            Use this look for all alerts
          </Button>
          <p className="text-xs leading-snug text-muted-foreground">
            Copies the typography, animation and where the media sits. Each alert keeps its own
            text, media and sound, and variations are left as they are.
          </p>
        </div>
      </div>
    </div>
  );
}
