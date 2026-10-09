import type { WidgetBaseDefinition } from "../../widget-definition";
import { POLL_WIDGET_PRESET_SIZES } from "../poll/poll-widget-config";
import {
  PREDICTION_WIDGET_TYPE,
  createDefaultPredictionWidgetConfig,
  normalizePredictionWidgetConfig,
} from "./prediction-widget-config";
import { PredictionWidgetRenderer } from "./PredictionWidgetRenderer";

/** Drawn by the poll designs, so it starts at the same size. */
export const PREDICTION_WIDGET_DEFAULT_SIZE = POLL_WIDGET_PRESET_SIZES.bars;

export const predictionWidgetBaseDefinition: WidgetBaseDefinition<typeof PREDICTION_WIDGET_TYPE> = {
  type: PREDICTION_WIDGET_TYPE,
  defaultSize: { ...PREDICTION_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultPredictionWidgetConfig,
  Renderer: PredictionWidgetRenderer,
  collectFontFamilies: (item) => [normalizePredictionWidgetConfig(item.config).fontFamily],
};
