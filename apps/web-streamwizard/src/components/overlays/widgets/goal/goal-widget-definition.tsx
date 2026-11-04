"use client";

import type { OverlayItem } from "@/types/overlays";
import {
  GOAL_WIDGET_DEFAULT_SIZE,
  GOAL_WIDGET_LABELS,
  createDefaultGoalWidgetConfig,
  type GoalWidgetType,
} from "@repo/ui/overlay";
import type { CreateRootItemContext } from "@/components/overlays/registry/overlay-widget-registry.types";
import { createCenteredRootItem } from "@/components/overlays/registry/create-root-item";

export { GOAL_WIDGET_DEFAULT_SIZE } from "@repo/ui/overlay";

/** Places one goal widget of `type`, centred, labelled "Follower goal 2" and so on. */
export function createGoalWidgetRootItems(type: GoalWidgetType) {
  return (ctx: CreateRootItemContext): OverlayItem[] => [
    createCenteredRootItem(ctx, {
      type,
      size: GOAL_WIDGET_DEFAULT_SIZE,
      label: GOAL_WIDGET_LABELS[type].title,
      config: createDefaultGoalWidgetConfig(),
    }),
  ];
}
