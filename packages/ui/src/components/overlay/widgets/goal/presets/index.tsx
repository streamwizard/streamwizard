"use client";

import type { ComponentType } from "react";
import type { GoalWidgetPreset } from "../goal-widget-config";
import { GoalArcade } from "./GoalArcade";
import { GoalBar } from "./GoalBar";
import { GoalBlocks } from "./GoalBlocks";
import { GoalLiquid } from "./GoalLiquid";
import { GoalRing } from "./GoalRing";
import { GoalStrip } from "./GoalStrip";
import { GoalText } from "./GoalText";
import { GoalTube } from "./GoalTube";
import type { GoalPresetProps } from "./shared";

export const GOAL_PRESET_COMPONENTS: Record<GoalWidgetPreset, ComponentType<GoalPresetProps>> = {
  bar: GoalBar,
  strip: GoalStrip,
  text: GoalText,
  ring: GoalRing,
  blocks: GoalBlocks,
  tube: GoalTube,
  arcade: GoalArcade,
  liquid: GoalLiquid,
};

export { GOAL_KEYFRAMES, Confetti, useCelebration, useProgressPulse, type GoalPresetProps } from "./shared";
