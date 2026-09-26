import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  POLL_WIDGET_PRESET_SIZES,
  POLL_WIDGET_TYPE,
  createDefaultPollWidgetConfig,
  normalizePollWidgetConfig,
} from "./poll-widget-config";
import { PollWidgetRenderer } from "./PollWidgetRenderer";

export const POLL_WIDGET_DEFAULT_SIZE = POLL_WIDGET_PRESET_SIZES.bars;

export const pollWidgetBaseDefinition: WidgetBaseDefinition<typeof POLL_WIDGET_TYPE> = {
  type: POLL_WIDGET_TYPE,
  defaultSize: { ...POLL_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultPollWidgetConfig,
  Renderer: PollWidgetRenderer,
  collectFontFamilies: (item) => [normalizePollWidgetConfig(item.config).fontFamily],
};
