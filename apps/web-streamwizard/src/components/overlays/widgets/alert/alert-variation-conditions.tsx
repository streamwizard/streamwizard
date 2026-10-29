"use client";

import { Plus, X } from "lucide-react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@repo/ui";
import {
  ALERT_SUB_TIERS,
  ALERT_VARIATION_LIMITS,
  alertTierLabel,
  alertVariationOperators,
  alertVariationParameters,
  createAlertCondition,
  normalizeAlertName,
  type AlertEventType,
  type AlertSubTier,
  type AlertVariationCondition,
  type AlertVariationMatch,
  type AlertVariationOperator,
  type AlertVariationParameter,
} from "@repo/ui/overlay";
import { InspectorHint, NumberField, SegmentedField } from "@/components/overlays/inspector-fields";
import { DraftInput } from "./alert-draft-input";
import { alertAmountTitle, alertParameterLabel, OPERATOR_LABELS } from "./alert-widget-labels";

const MATCH_OPTIONS = [
  { value: "all", label: "All of them" },
  { value: "any", label: "Any of them" },
] as const satisfies readonly { value: AlertVariationMatch; label: string }[];

export interface AlertVariationConditionsProps {
  event: AlertEventType;
  /** Keeps field ids unique when several editors are mounted. */
  idPrefix: string;
  match: AlertVariationMatch;
  conditions: AlertVariationCondition[];
  onChange: (updates: { match?: AlertVariationMatch; conditions?: AlertVariationCondition[] }) => void;
}

/**
 * The conditions a variation checks, one row each, and whether all of them or
 * any one has to hold. Each row only offers what its alert's events carry, so
 * no row can ask for something that never arrives.
 */
export function AlertVariationConditions({
  event,
  idPrefix,
  match,
  conditions,
  onChange,
}: AlertVariationConditionsProps) {
  const parameters = alertVariationParameters(event);
  const full = conditions.length >= ALERT_VARIATION_LIMITS.conditions;

  const setRow = (index: number, condition: AlertVariationCondition) =>
    onChange({ conditions: conditions.map((c, i) => (i === index ? condition : c)) });

  const addRow = () => {
    // Start on something not checked yet; an amount again is still allowed.
    const used = new Set(conditions.map((c) => c.parameter));
    const next = parameters.find((p) => !used.has(p)) ?? parameters[0];
    if (next) onChange({ conditions: [...conditions, createAlertCondition(next)] });
  };

  return (
    <div className="space-y-3">
      {conditions.length > 1 ? (
        <SegmentedField
          id={`${idPrefix}-match`}
          label="Plays when"
          value={match}
          options={MATCH_OPTIONS}
          onChange={(value) => onChange({ match: value })}
        />
      ) : null}

      {conditions.length === 0 ? (
        <p className="text-xs leading-snug text-muted-foreground">
          No conditions, so it plays every time. Chance still applies.
        </p>
      ) : (
        <ul className="space-y-2">
          {conditions.map((condition, index) => (
            <li key={index} className="rounded-md border p-2.5">
              <ConditionRow
                event={event}
                id={`${idPrefix}-condition-${index}`}
                index={index}
                parameters={parameters}
                condition={condition}
                onChange={(next) => setRow(index, next)}
                onRemove={() => onChange({ conditions: conditions.filter((_, i) => i !== index) })}
              />
            </li>
          ))}
        </ul>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        disabled={full}
        title={full ? `A variation can check up to ${ALERT_VARIATION_LIMITS.conditions} things` : undefined}
        onClick={addRow}
      >
        <Plus />
        Add condition
      </Button>
    </div>
  );
}

function ConditionRow({
  event,
  id,
  index,
  parameters,
  condition,
  onChange,
  onRemove,
}: {
  event: AlertEventType;
  id: string;
  index: number;
  parameters: readonly AlertVariationParameter[];
  condition: AlertVariationCondition;
  onChange: (condition: AlertVariationCondition) => void;
  onRemove: () => void;
}) {
  const amountTitle = alertAmountTitle(event);

  return (
    <div className="space-y-2.5">
      <div className="flex items-end gap-1.5">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label id={`${id}-parameter`} className="text-xs">
            Looks at
          </Label>
          <Select
            value={condition.parameter}
            onValueChange={(v) => onChange(createAlertCondition(v as AlertVariationParameter))}
          >
            <SelectTrigger aria-labelledby={`${id}-parameter`} className="h-9 w-full text-sm">
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
        <Button
          size="icon-xs"
          variant="ghost"
          className="size-9 shrink-0 text-muted-foreground"
          aria-label={`Remove condition ${index + 1}`}
          title="Remove this condition"
          onClick={onRemove}
        >
          <X className="size-4" />
        </Button>
      </div>

      {condition.parameter === "amount" ? (
        <div className="grid grid-cols-[1fr_6rem] gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1">
              <Label id={`${id}-operator`} className="text-xs">
                Plays when it is
              </Label>
              {condition.operator === "session_top" ? (
                <InspectorHint label="About the biggest of the stream">
                  The biggest since the overlay loaded. Reloading the browser source in OBS starts
                  the count again. The number beside it is a floor: 0 means any new record counts.
                </InspectorHint>
              ) : null}
            </div>
            <Select
              value={condition.operator}
              onValueChange={(v) => {
                const operator = v as AlertVariationOperator;
                const { value } = condition;
                onChange(
                  operator === "between"
                    ? { parameter: "amount", operator, value, max: Math.max(value, condition.max ?? 0) }
                    : { parameter: "amount", operator, value }
                );
              }}
            >
              <SelectTrigger aria-labelledby={`${id}-operator`} className="h-9 w-full text-sm">
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
              {condition.operator === "session_top"
                ? "At least"
                : condition.operator === "between"
                  ? "From"
                  : amountTitle}
            </Label>
            <NumberField
              value={condition.value}
              min={0}
              aria-label={
                condition.operator === "between"
                  ? `${amountTitle} from`
                  : `${OPERATOR_LABELS[condition.operator]} ${amountTitle.toLowerCase()}`
              }
              className="h-9 text-sm tabular-nums"
              onCommit={(value) =>
                onChange(
                  condition.operator === "between"
                    ? { ...condition, value, max: Math.max(value, condition.max ?? value) }
                    : { ...condition, value }
                )
              }
            />
          </div>
          {condition.operator === "between" ? (
            <div className="col-start-2 space-y-1.5">
              <Label className="truncate text-xs">To</Label>
              <NumberField
                value={condition.max ?? condition.value}
                min={0}
                aria-label={`${amountTitle} to`}
                className="h-9 text-sm tabular-nums"
                onCommit={(max) =>
                  onChange({
                    ...condition,
                    value: Math.min(condition.value, max),
                    max: Math.max(condition.value, max),
                  })
                }
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {condition.parameter === "tier" ? (
        <div className="space-y-1.5">
          <Label id={`${id}-tier`} className="text-xs">
            Tier
          </Label>
          <Select
            value={condition.tier}
            onValueChange={(v) => onChange({ parameter: "tier", tier: v as AlertSubTier })}
          >
            <SelectTrigger aria-labelledby={`${id}-tier`} className="h-9 w-full text-sm">
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
          <Label htmlFor={`${id}-names`} className="text-xs">
            Viewers
          </Label>
          <DraftInput
            id={`${id}-names`}
            stored={condition.names.join(", ")}
            placeholder="toastcrumb, ninetoad"
            onChange={(text) =>
              onChange({
                parameter: "name",
                names: [...new Set(text.split(",").map(normalizeAlertName).filter(Boolean))],
              })
            }
          />
          <p className="text-xs leading-snug text-muted-foreground">
            Twitch usernames with commas between them. Capitals do not matter.
          </p>
        </div>
      ) : null}

      {condition.parameter === "gifted" || condition.parameter === "anonymous" ? (
        <div className="space-y-1.5">
          <Label id={`${id}-flag`} className="text-xs">
            {condition.parameter === "gifted" ? "Plays for" : "Plays when the viewer is"}
          </Label>
          <Select
            value={condition.value ? "yes" : "no"}
            onValueChange={(v) => onChange({ ...condition, value: v === "yes" })}
          >
            <SelectTrigger aria-labelledby={`${id}-flag`} className="h-9 w-full text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes" className="text-sm">
                {condition.parameter === "gifted" ? "Gifted subs" : "Anonymous"}
              </SelectItem>
              <SelectItem value="no" className="text-sm">
                {condition.parameter === "gifted" ? "Subs they paid for" : "Not anonymous"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
