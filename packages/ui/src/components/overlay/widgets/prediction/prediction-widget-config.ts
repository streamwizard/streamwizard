import {
  POLL_DEFAULT_CHOICE_COLORS,
  createDefaultPollWidgetConfig,
  normalizePollWidgetConfig,
  type PollWidgetItemConfig,
} from "../poll/poll-widget-config";

/**
 * Shows the channel's Twitch prediction: the question, each outcome's share of
 * the channel points as viewers pile in, a countdown until it locks, and the
 * winner once the streamer calls it. Predictions are started on Twitch
 * (Stream Manager or /prediction in chat); the widget only shows them.
 *
 * It is drawn by the poll widget's designs, so its config is the poll's plus
 * what only a prediction has. `choiceColors` holds the outcome colors and
 * `showVotes` the channel points, under the names the designs read.
 */
export const PREDICTION_WIDGET_TYPE = "prediction_widget" as const;
export type PredictionWidgetType = typeof PREDICTION_WIDGET_TYPE;

/** Twitch allows 2 to 10 outcomes. */
export const PREDICTION_MAX_OUTCOMES = 10;

/** The poll's five, then five more that sit well beside them. */
export const PREDICTION_DEFAULT_OUTCOME_COLORS = [
  ...POLL_DEFAULT_CHOICE_COLORS,
  "#ff8a7a",
  "#c8e36b",
  "#7ad7d0",
  "#d59bff",
  "#f2d06b",
] as const;

export interface PredictionWidgetItemConfig extends PollWidgetItemConfig {
  /**
   * A locked prediction can wait a whole match for its result. On: it stays
   * up the whole time. Off: it hides once locked and comes back for the result.
   */
  showWhileLocked: boolean;
}

export function createDefaultPredictionWidgetConfig(): PredictionWidgetItemConfig {
  return {
    ...createDefaultPollWidgetConfig(),
    choiceColors: [...PREDICTION_DEFAULT_OUTCOME_COLORS],
    showWhileLocked: true,
  };
}

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Fills gaps and clamps a stored config, so a partial or old row still renders. */
export function normalizePredictionWidgetConfig(raw: unknown): PredictionWidgetItemConfig {
  const d = createDefaultPredictionWidgetConfig();
  const c = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PredictionWidgetItemConfig, unknown>>;
  const stored = Array.isArray(c.choiceColors) ? c.choiceColors : [];
  return {
    ...normalizePollWidgetConfig(raw),
    // The poll's normalizer keeps five colors; a prediction has room for ten.
    choiceColors: d.choiceColors.map((fallback, i) => {
      const value = stored[i];
      return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
    }),
    showWhileLocked: typeof c.showWhileLocked === "boolean" ? c.showWhileLocked : d.showWhileLocked,
  };
}
