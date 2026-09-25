"use client";

import type { ComponentType } from "react";
import type { CreditsWidgetPreset } from "../credits-widget-config";
import { CreditsArcade } from "./CreditsArcade";
import { CreditsCards } from "./CreditsCards";
import { CreditsCinematic } from "./CreditsCinematic";
import { CreditsHybrid } from "./CreditsHybrid";
import { CreditsClassic } from "./CreditsClassic";
import { CreditsMinimal } from "./CreditsMinimal";
import { CreditsTicker } from "./CreditsTicker";
import type { CreditsPresetProps } from "./shared";

export const CREDITS_PRESET_COMPONENTS: Record<CreditsWidgetPreset, ComponentType<CreditsPresetProps>> = {
  classic: CreditsClassic,
  cards: CreditsCards,
  ticker: CreditsTicker,
  arcade: CreditsArcade,
  minimal: CreditsMinimal,
  cinematic: CreditsCinematic,
  hybrid: CreditsHybrid,
};

export { CREDITS_KEYFRAMES, type CreditsPresetProps } from "./shared";
