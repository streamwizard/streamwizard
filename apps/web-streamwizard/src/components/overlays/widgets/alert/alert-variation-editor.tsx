"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@repo/ui";
import {
  ALERT_EVENT_LABELS,
  ALERT_SUB_TIERS,
  ALERT_VARIATION_LIMITS,
  alertTierLabel,
  alertVariationOperators,
  alertVariationParameters,
  alertVariationSummary,
  normalizeAlertName,
  type AlertEventType,
  type AlertPresentation,
  type AlertSubTier,
  type AlertVariation,
  type AlertVariationCondition,
  type AlertVariationOperator,
  type AlertVariationParameter,
} from "@repo/ui/overlay";
import {
  InspectorHint,
  InspectorSection,
  NumberField,
  SliderField,
} from "@/components/overlays/inspector-fields";
import { AlertPresentationFields, type AlertFieldGroup } from "./alert-presentation-fields";
import { alertAmountTitle, alertParameterLabel, OPERATOR_LABELS } from "./alert-widget-labels";

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

/** The condition a variation gets when its parameter is switched to `parameter`. */
function defaultCondition(parameter: AlertVariationParameter): AlertVariationCondition {
  switch (parameter) {
    case "amount":
      return { parameter, operator: "at_least", value: 1 };
    case "tier":
      return { parameter, tier: "1000" };
    case "name":
      return { parameter, names: [] };
    case "none":
      return { parameter };
  }
}

/**
 * A text field that keeps what is being typed to itself. The stored value is
 * cleaned on every read (an empty name gets a default, usernames lose their
 * spaces and capitals), and a field bound straight to it would rewrite the
 * text under the cursor. It shows the stored value again once focus leaves.
 */
function DraftInput({
  id,
  stored,
  maxLength,
  placeholder,
  onChange,
}: {
  id: string;
  stored: string;
  maxLength?: number;
  placeholder?: string;
  onChange: (text: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <Input
      id={id}
      value={draft ?? stored}
      maxLength={maxLength}
      placeholder={placeholder}
      className="h-9 text-sm"
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(e.target.value);
      }}
      onBlur={() => setDraft(null)}
    />
  );
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
  const parameters = alertVariationParameters(event);
  const { condition } = variation;
  const amountTitle = alertAmountTitle(event);

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
            title="Plays this variation, whatever its condition"
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

            <div className="space-y-1.5">
              <Label id={`alert-variation-parameter-${variation.id}`} className="text-xs">
                Looks at
              </Label>
              <Select
                value={condition.parameter}
                onValueChange={(v) =>
                  onPatch({ condition: defaultCondition(v as AlertVariationParameter) })
                }
              >
                <SelectTrigger
                  aria-labelledby={`alert-variation-parameter-${variation.id}`}
                  className="h-9 w-full text-sm"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {parameters.map((parameter) => (
                    <SelectItem key={parameter} value={parameter} className="text-sm">
                      {alertParameterLabel(event, parameter)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {condition.parameter === "amount" ? (
              <div className="grid grid-cols-[1fr_6rem] gap-2">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    <Label id={`alert-variation-operator-${variation.id}`} className="text-xs">
                      Plays when it is
                    </Label>
                    {condition.operator === "session_top" ? (
                      <InspectorHint label="About the biggest of the stream">
                        The biggest since the overlay loaded. Reloading the browser source in OBS
                        starts the count again. The number beside it is a floor: 0 means any new
                        record counts.
                      </InspectorHint>
                    ) : null}
                  </div>
                  <Select
                    value={condition.operator}
                    onValueChange={(v) =>
                      onPatch({
                        condition: { ...condition, operator: v as AlertVariationOperator },
                      })
                    }
                  >
                    <SelectTrigger
                      aria-labelledby={`alert-variation-operator-${variation.id}`}
                      className="h-9 w-full text-sm"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {alertVariationOperators(event).map((operator) => (
                        <SelectItem key={operator} value={operator} className="text-sm">
                          {OPERATOR_LABELS[operator]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="truncate text-xs">
                    {condition.operator === "session_top" ? "At least" : amountTitle}
                  </Label>
                  <NumberField
                    value={condition.value}
                    min={0}
                    aria-label={`${OPERATOR_LABELS[condition.operator]} ${amountTitle.toLowerCase()}`}
                    className="h-9 text-sm tabular-nums"
                    onCommit={(value) => onPatch({ condition: { ...condition, value } })}
                  />
                </div>
              </div>
            ) : null}

            {condition.parameter === "tier" ? (
              <div className="space-y-1.5">
                <Label id={`alert-variation-tier-${variation.id}`} className="text-xs">
                  Tier
                </Label>
                <Select
                  value={condition.tier}
                  onValueChange={(v) =>
                    onPatch({ condition: { parameter: "tier", tier: v as AlertSubTier } })
                  }
                >
                  <SelectTrigger
                    aria-labelledby={`alert-variation-tier-${variation.id}`}
                    className="h-9 w-full text-sm"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALERT_SUB_TIERS.map((tier) => (
                      <SelectItem key={tier} value={tier} className="text-sm">
                        {alertTierLabel(tier)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}

            {condition.parameter === "name" ? (
              <div className="space-y-1.5">
                <Label htmlFor={`alert-variation-names-${variation.id}`} className="text-xs">
                  Viewers
                </Label>
                <DraftInput
                  id={`alert-variation-names-${variation.id}`}
                  stored={condition.names.join(", ")}
                  placeholder="toastcrumb, ninetoad"
                  onChange={(text) =>
                    onPatch({
                      condition: {
                        parameter: "name",
                        names: [...new Set(text.split(",").map(normalizeAlertName).filter(Boolean))],
                      },
                    })
                  }
                />
                <p className="text-xs leading-snug text-muted-foreground">
                  Twitch usernames with commas between them. Capitals do not matter.
                </p>
              </div>
            ) : null}

            <SliderField
              id={`alert-variation-chance-${variation.id}`}
              label="Chance"
              unit="%"
              value={variation.chance}
              min={0}
              max={100}
              hint="How often it plays when its condition is met. 25 is about one in four; the rest of the time the next best match plays."
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
