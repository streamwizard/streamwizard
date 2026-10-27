"use client";

import { useLayoutEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { Button, Label, Switch } from "@repo/ui";
import {
  ALERT_EVENT_LABELS,
  ALERT_VARIATION_LIMITS,
  alertVariationSummary,
  type AlertEventType,
  type AlertPresentation,
  type AlertVariation,
} from "@repo/ui/overlay";
import { InspectorSection, SliderField } from "@/components/overlays/inspector-fields";
import { DraftInput } from "./alert-draft-input";
import { AlertPresentationFields, type AlertFieldGroup } from "./alert-presentation-fields";
import { AlertVariationConditions } from "./alert-variation-conditions";

export type AlertVariationGroup = AlertFieldGroup | "condition";

export interface AlertVariationEditorProps {
  event: AlertEventType;
  variation: AlertVariation;
  /** Whether Cancel has anything to take back. */
  canCancel: boolean;
  /** A variation that did not exist when the editor opened: Cancel removes it. */
  isNew: boolean;
  masterVolume: number;
  openGroups: Record<AlertVariationGroup, boolean>;
  onOpenGroupChange: (group: AlertVariationGroup, open: boolean) => void;
  testBusy: boolean;
  onDone: () => void;
  onCancel: () => void;
  onPatch: (updates: Partial<AlertVariation>) => void;
  onTest: () => void;
}

/**
 * One variation on its own: when it plays, then everything about how it looks
 * and sounds. Edits apply as they are made, like the rest of the editor, so
 * Test always plays what is on screen here; Cancel puts back what was there
 * when this opened.
 */
export function AlertVariationEditor({
  event,
  variation,
  canCancel,
  isNew,
  masterVolume,
  openGroups,
  onOpenGroupChange,
  testBusy,
  onDone,
  onCancel,
  onPatch,
  onTest,
}: AlertVariationEditorProps) {
  const backRef = useRef<HTMLButtonElement>(null);
  const alertLabel = ALERT_EVENT_LABELS[event];

  useLayoutEffect(() => {
    backRef.current?.focus({ preventScroll: true });
  }, []);

  const patchSettings = (updates: Partial<AlertPresentation>) =>
    onPatch({ settings: { ...variation.settings, ...updates } });

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 space-y-3 border-b bg-background px-4 pb-3 pt-1">
        <div className="flex items-center justify-between gap-2">
          <Button ref={backRef} size="sm" variant="outline" className="min-w-0" onClick={onDone}>
            <ArrowLeft />
            <span className="truncate">{alertLabel}</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="shrink-0 text-muted-foreground"
            disabled={!canCancel}
            title={isNew ? "Removes this new variation" : "Puts this variation back as it was"}
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <h3 className="min-w-0 flex-1 truncate text-base font-semibold" title={variation.name}>
            {variation.name}
          </h3>
          <span className="text-xs text-muted-foreground" aria-hidden>
            {variation.enabled ? "On" : "Off"}
          </span>
          <Switch
            aria-label={`${variation.name} variation`}
            checked={variation.enabled}
            onCheckedChange={(enabled) => onPatch({ enabled })}
          />
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            disabled={testBusy}
            aria-label={`Test the ${variation.name} variation`}
            title="Plays this variation, whatever its conditions"
            onClick={onTest}
          >
            Test
          </Button>
        </div>
      </div>

      <div className="space-y-6 pt-5">
        <InspectorSection
          title="When it plays"
          open={openGroups.condition}
          onOpenChange={(open) => onOpenGroupChange("condition", open)}
        >
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor={`alert-variation-name-${variation.id}`} className="text-xs">
                Name
              </Label>
              <DraftInput
                id={`alert-variation-name-${variation.id}`}
                stored={variation.name}
                maxLength={ALERT_VARIATION_LIMITS.nameLength}
                onChange={(text) => {
                  // An empty name would only be swapped for a default on the
                  // next read; hold the last real one until there is another.
                  if (text.trim()) onPatch({ name: text });
                }}
              />
            </div>

            <AlertVariationConditions
              event={event}
              idPrefix={`alert-variation-${variation.id}`}
              match={variation.match}
              conditions={variation.conditions}
              onChange={onPatch}
            />

            <SliderField
              id={`alert-variation-chance-${variation.id}`}
              label="Chance"
              unit="%"
              value={variation.chance}
              min={0}
              max={100}
              hint="How often it plays when its conditions are met. 25 is about one in four; the rest of the time the next best match plays."
              onChange={(chance) => onPatch({ chance })}
            />

            <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-snug">
              <span className="text-muted-foreground">Plays for: </span>
              {alertVariationSummary(event, variation)}
            </p>
          </div>
        </InspectorSection>

        <AlertPresentationFields
          event={event}
          value={variation.settings}
          masterVolume={masterVolume}
          openGroups={openGroups}
          onOpenGroupChange={onOpenGroupChange}
          onPatch={patchSettings}
        />
      </div>
    </div>
  );
}
