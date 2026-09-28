import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  CREDITS_WIDGET_PRESET_SIZES,
  CREDITS_WIDGET_TYPE,
  createDefaultCreditsWidgetConfig,
  normalizeCreditsWidgetConfig,
} from "./credits-widget-config";
import { CreditsWidgetRenderer } from "./CreditsWidgetRenderer";

export const CREDITS_WIDGET_DEFAULT_SIZE = CREDITS_WIDGET_PRESET_SIZES.classic;

export const creditsWidgetBaseDefinition: WidgetBaseDefinition<typeof CREDITS_WIDGET_TYPE> = {
  type: CREDITS_WIDGET_TYPE,
  defaultSize: { ...CREDITS_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultCreditsWidgetConfig,
  Renderer: CreditsWidgetRenderer,
  collectFontFamilies: (item) => [normalizeCreditsWidgetConfig(item.config).fontFamily],
};
