import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  COMBO_WIDGET_TYPE,
  createDefaultComboWidgetConfig,
  normalizeComboWidgetConfig,
} from "./combo-widget-config";
import { ComboWidgetRenderer } from "./ComboWidgetRenderer";

export const COMBO_WIDGET_DEFAULT_SIZE = { w: 480, h: 160 } as const;

export const comboWidgetBaseDefinition: WidgetBaseDefinition<typeof COMBO_WIDGET_TYPE> = {
  type: COMBO_WIDGET_TYPE,
  defaultSize: { ...COMBO_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultComboWidgetConfig,
  Renderer: ComboWidgetRenderer,
  collectFontFamilies: (item) => [normalizeComboWidgetConfig(item.config).fontFamily],
};
