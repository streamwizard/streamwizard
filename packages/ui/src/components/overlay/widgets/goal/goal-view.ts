import {
  GOAL_WIDGET_LABELS,
  TWITCH_GOAL_TYPE_LABELS,
  type GoalWidgetItemConfig,
  type GoalWidgetType,
  type TwitchGoalType,
} from "./goal-widget-config";
import { goalProgress, type GoalSnapshot } from "./goal-widget-state";

/** Which built-in icon a goal kind gets. */
export type GoalIconKind = "heart" | "star" | "gem";

/**
 * Everything a preset draws, worked out once. Presets only lay this out; the
 * wording and the maths live here so every design says the same thing.
 */
export interface GoalView {
  goalId: string;
  /** Empty when neither the streamer nor Twitch named the goal: then no title shows. */
  title: string;
  /** Always set, for screen readers: the title, or the widget's name. */
  label: string;
  current: number;
  target: number;
  /** 0–1. */
  progress: number;
  remaining: number;
  unit: string;
  currentText: string;
  targetText: string;
  /** "120 / 500 subs". */
  numbersText: string;
  /** "24%". */
  percentText: string;
  /** "12 subs to go", or "Goal reached". */
  remainingText: string;
  /** The target is met, whether or not Twitch has ended the goal yet. */
  reached: boolean;
  ended: boolean;
  icon: GoalIconKind;
}

const numberFormat = new Intl.NumberFormat();

export function goalIconFor(type: TwitchGoalType): GoalIconKind {
  if (type === "follow") return "heart";
  if (type === "new_bit" || type === "new_cheerer") return "gem";
  return "star";
}

export function buildGoalView(
  goal: GoalSnapshot,
  cfg: Pick<GoalWidgetItemConfig, "title">,
  widgetType: GoalWidgetType,
): GoalView {
  const labels = TWITCH_GOAL_TYPE_LABELS[goal.type];
  const progress = goalProgress(goal);
  const remaining = Math.max(0, goal.target - goal.current);
  const reached = (goal.target > 0 && goal.current >= goal.target) || goal.ended?.achieved === true;
  const title = cfg.title.trim() || goal.description.trim();
  const currentText = numberFormat.format(goal.current);
  const targetText = numberFormat.format(goal.target);
  return {
    goalId: goal.id,
    title,
    label: title || GOAL_WIDGET_LABELS[widgetType].title,
    current: goal.current,
    target: goal.target,
    progress,
    remaining,
    unit: labels.unit,
    currentText,
    targetText,
    numbersText: `${currentText} / ${targetText} ${labels.unit}`,
    // Floor, so 99.6% never reads 100% before the goal is actually met.
    percentText: `${reached ? 100 : Math.floor(progress * 100)}%`,
    remainingText: reached
      ? "Goal reached"
      : `${numberFormat.format(remaining)} ${remaining === 1 ? labels.one : labels.unit} to go`,
    reached,
    ended: goal.ended !== null,
    icon: goalIconFor(goal.type),
  };
}

/**
 * Segments for Blocks. Small targets get one block per unit, so each follow
 * lights one up; bigger ones get 10. A hand-set count always wins.
 */
export function goalBlockCount(target: number, configured: number): number {
  if (configured > 0) return configured;
  if (target >= 1 && target <= 20) return Math.round(target);
  return 10;
}

/** How many blocks are fully lit, and how far the next one is filled (0–1). */
export function goalBlocksLit(progress: number, count: number): { full: number; partial: number } {
  const lit = Math.min(count, Math.max(0, progress * count));
  const full = Math.floor(lit + 1e-9);
  return { full, partial: full >= count ? 0 : lit - full };
}
