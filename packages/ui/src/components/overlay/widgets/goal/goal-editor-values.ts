import type { EditorGoalValue } from "../../hooks/use-editor-preview-values";
import type { TwitchGoalType } from "./goal-widget-config";
import type { GoalSnapshot } from "./goal-widget-state";

/** What a goal reads when only a current amount was typed in and no goal runs. */
export const EDITOR_GOAL_DEFAULT_TARGET = 100;

/**
 * Lays numbers typed into the editor over the goal on screen. With no goal
 * running it makes one up, so a bar can be styled before Twitch has a goal.
 */
export function applyEditorGoalValue(
  goal: GoalSnapshot | null,
  value: EditorGoalValue | undefined,
  type: TwitchGoalType
): GoalSnapshot | null {
  if (!value || (value.current === undefined && value.target === undefined)) return goal;
  return {
    id: goal?.id ?? "editor-goal",
    type: goal?.type ?? type,
    description: goal?.description ?? "",
    current: value.current ?? goal?.current ?? 0,
    target: value.target ?? goal?.target ?? EDITOR_GOAL_DEFAULT_TARGET,
    ended: goal?.ended ?? null,
  };
}
