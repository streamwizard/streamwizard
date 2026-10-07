import {
  ALERT_AMOUNT_LABELS,
  ALERT_NAME_LABELS,
  type AlertVariationOperator,
  type AlertVariationParameter,
  type AlertEventType,
  type AlertLayout,
  type AlertTemplateToken,
} from "@repo/ui/overlay";

/** Human labels for the alert widget's layout, animation and token options. */

/** Where the image or video sits against the text; short enough for three tiles in a row. */
export const LAYOUT_OPTIONS: readonly { value: AlertLayout; label: string }[] = [
  { value: "stacked", label: "Above text" },
  { value: "row", label: "Beside text" },
  { value: "overlay", label: "Behind text" },
];

/** What a token prints on this alert, as one short sentence for its chip. */
export function alertTokenMeaning(event: AlertEventType, token: AlertTemplateToken): string {
  switch (token) {
    case "name":
      return `{name} is ${ALERT_NAME_LABELS[event]}.`;
    case "amount":
      return `{amount} is ${ALERT_AMOUNT_LABELS[event] ?? "the number"}.`;
    case "message":
      return "{message} is what the viewer wrote.";
    case "gifter":
      return "{gifter} is who gave the original sub.";
    case "reward":
      return "{reward} is the reward.";
    case "charity":
      return "{charity} is the charity.";
    case "recipient":
      return "{recipient} is who got the sub.";
  }
}

/**
 * An effect's name as the editor shows it: "Fade up big", "Flip X", "Rotate
 * down left". The "in" or "out" is left off: the field it sits in is already
 * called Enter or Exit, and the full name does not fit the picker.
 */
export function alertEffectLabel(effect: string): string {
  if (effect === "none") return "None";
  const words = effect
    .split("_")
    .filter((word) => word !== "in" && word !== "out")
    .map((word) => (word === "x" || word === "y" ? word.toUpperCase() : word));
  const text = words.join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** The families the enter and exit effects come in, in the order the picker lists them. */
const EFFECT_FAMILIES = [
  { prefix: "bounce", label: "Bounce" },
  { prefix: "fade", label: "Fade" },
  { prefix: "flip", label: "Flip" },
  { prefix: "light_speed", label: "Light speed" },
  { prefix: "rotate", label: "Rotate" },
  { prefix: "roll", label: "Roll" },
  { prefix: "zoom", label: "Zoom" },
  { prefix: "slide", label: "Slide" },
] as const;

/** Enter or exit effects grouped by family, `none` left out. */
export function groupAlertEffects<T extends string>(effects: readonly T[]): { label: string; effects: T[] }[] {
  return EFFECT_FAMILIES.map(({ prefix, label }) => ({
    label,
    effects: effects.filter((effect) => effect.startsWith(`${prefix}_`)),
  })).filter((family) => family.effects.length > 0);
}

/** What an alert's amount is called, with a capital: "Bits", "Months", "Viewers". */
export function alertAmountTitle(event: AlertEventType): string {
  const unit = ALERT_AMOUNT_LABELS[event] ?? "amount";
  return unit.charAt(0).toUpperCase() + unit.slice(1);
}

/** What a variation can look at, as the choice reads in the editor. */
export function alertParameterLabel(event: AlertEventType, parameter: AlertVariationParameter): string {
  switch (parameter) {
    case "none":
      return "Nothing, chance only";
    case "amount":
      return alertAmountTitle(event);
    case "tier":
      return "Sub tier";
    case "name":
      return "Viewer name";
  }
}

export const OPERATOR_LABELS: Record<AlertVariationOperator, string> = {
  exact: "Exactly",
  at_least: "At least",
  session_top: "Biggest of the stream",
};
