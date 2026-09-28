"use client";

import type { ComponentType } from "react";
import type { AdWidgetPreset } from "../ad-widget-config";
import { AdBadge } from "./AdBadge";
import { AdBar } from "./AdBar";
import { AdCard } from "./AdCard";
import { AdPill } from "./AdPill";
import { AdRing } from "./AdRing";
import type { AdPresetProps } from "./shared";

export const AD_PRESET_COMPONENTS: Record<AdWidgetPreset, ComponentType<AdPresetProps>> = {
  badge: AdBadge,
  pill: AdPill,
  bar: AdBar,
  card: AdCard,
  ring: AdRing,
};

export { AD_KEYFRAMES, GOAL_KEYFRAMES, SWAP_ANIMATION, type AdPresetProps } from "./shared";
