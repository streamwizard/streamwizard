import type { WidgetBaseDefinition } from "../../widget-definition";
import { DEFAULT_CLOCK_WIDGET_ITEM_CONFIG, normalizeClockWidgetConfig, resolvedTextWidgetFontFamily } from "../../types";
import { ClockWidgetRenderer } from "./ClockWidgetRenderer";

export const CLOCK_WIDGET_DEFAULT_SIZE = { w: 400, h: 100 } as const;

export const clockWidgetBaseDefinition: WidgetBaseDefinition<"clock_widget"> = {
  type: "clock_widget",
  defaultSize: { ...CLOCK_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: () => ({ ...DEFAULT_CLOCK_WIDGET_ITEM_CONFIG }),
  Renderer: ClockWidgetRenderer,
  collectFontFamilies: (item) => {
    const cfg = normalizeClockWidgetConfig(item.config);
    const ff = resolvedTextWidgetFontFamily(cfg);
    return ff ? [ff] : [];
  },
};
