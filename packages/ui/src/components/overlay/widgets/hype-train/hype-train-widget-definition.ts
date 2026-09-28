import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  HYPE_TRAIN_WIDGET_TYPE,
  createDefaultHypeTrainWidgetConfig,
  normalizeHypeTrainWidgetConfig,
} from "./hype-train-widget-config";
import { HypeTrainWidgetRenderer } from "./HypeTrainWidgetRenderer";

/** The whole screen, so a bouncing train can roam all of it. */
export const HYPE_TRAIN_WIDGET_DEFAULT_SIZE = { w: 1920, h: 1080 } as const;

export const hypeTrainWidgetBaseDefinition: WidgetBaseDefinition<typeof HYPE_TRAIN_WIDGET_TYPE> = {
  type: HYPE_TRAIN_WIDGET_TYPE,
  defaultSize: { ...HYPE_TRAIN_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultHypeTrainWidgetConfig,
  Renderer: HypeTrainWidgetRenderer,
  collectFontFamilies: (item) => [normalizeHypeTrainWidgetConfig(item.config).fontFamily],
};
