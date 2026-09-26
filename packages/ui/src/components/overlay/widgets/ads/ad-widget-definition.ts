import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  AD_WIDGET_PRESET_SIZES,
  AD_WIDGET_TYPE,
  createDefaultAdWidgetConfig,
  normalizeAdWidgetConfig,
} from "./ad-widget-config";
import { AdWidgetRenderer } from "./AdWidgetRenderer";

export const AD_WIDGET_DEFAULT_SIZE = AD_WIDGET_PRESET_SIZES.badge;

export const adWidgetBaseDefinition: WidgetBaseDefinition<typeof AD_WIDGET_TYPE> = {
  type: AD_WIDGET_TYPE,
  defaultSize: { ...AD_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultAdWidgetConfig,
  Renderer: AdWidgetRenderer,
  collectFontFamilies: (item) => [normalizeAdWidgetConfig(item.config).fontFamily],
};
