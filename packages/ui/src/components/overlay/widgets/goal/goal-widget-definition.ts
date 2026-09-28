import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  GOAL_WIDGET_PRESET_SIZES,
  createDefaultGoalWidgetConfig,
  normalizeGoalWidgetConfig,
  type GoalWidgetType,
} from "./goal-widget-config";
import { GoalWidgetRenderer } from "./GoalWidgetRenderer";

export const GOAL_WIDGET_DEFAULT_SIZE = GOAL_WIDGET_PRESET_SIZES.text;

function goalWidgetBaseDefinition<T extends GoalWidgetType>(type: T): WidgetBaseDefinition<T> {
  return {
    type,
    defaultSize: { ...GOAL_WIDGET_DEFAULT_SIZE },
    createDefaultConfig: createDefaultGoalWidgetConfig,
    Renderer: GoalWidgetRenderer,
    collectFontFamilies: (item) => [normalizeGoalWidgetConfig(item.config).fontFamily],
  };
}

export const followerGoalWidgetBaseDefinition = goalWidgetBaseDefinition("follower_goal_widget");
export const subGoalWidgetBaseDefinition = goalWidgetBaseDefinition("sub_goal_widget");
export const bitsGoalWidgetBaseDefinition = goalWidgetBaseDefinition("bits_goal_widget");
