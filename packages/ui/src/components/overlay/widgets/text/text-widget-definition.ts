import type { WidgetBaseDefinition } from "../../widget-definition";
import { DEFAULT_TEXT_WIDGET_ITEM_CONFIG, resolvedTextWidgetFontFamily, asTextWidgetConfig } from "../../types";
import { TextWidgetRenderer } from "./TextWidgetRenderer";

export const TEXT_WIDGET_DEFAULT_SIZE = { w: 320, h: 120 } as const;

export const textWidgetBaseDefinition: WidgetBaseDefinition<"text_widget"> = {
  type: "text_widget",
  defaultSize: { ...TEXT_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: () => ({ ...DEFAULT_TEXT_WIDGET_ITEM_CONFIG }),
  Renderer: TextWidgetRenderer,
  collectFontFamilies: (item) => {
    const ff = resolvedTextWidgetFontFamily(asTextWidgetConfig(item.config));
    return ff ? [ff] : [];
  },
};
