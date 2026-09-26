"use client";

import type { ComponentType } from "react";
import type { PollWidgetPreset } from "../poll-widget-config";
import { PollBars } from "./PollBars";
import { PollColumns } from "./PollColumns";
import { PollDonut } from "./PollDonut";
import { PollRace } from "./PollRace";
import { PollStrip } from "./PollStrip";
import type { PollPresetProps } from "./shared";

export const POLL_PRESET_COMPONENTS: Record<PollWidgetPreset, ComponentType<PollPresetProps>> = {
  bars: PollBars,
  columns: PollColumns,
  donut: PollDonut,
  strip: PollStrip,
  race: PollRace,
};

export {
  Confetti,
  GOAL_KEYFRAMES,
  POLL_KEYFRAMES,
  usePollCelebration,
  useVotePulses,
  type PollPresetProps,
} from "./shared";
