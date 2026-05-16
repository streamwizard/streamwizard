import type { WidgetBaseDefinition } from "../../widget-definition";
import { TIMER_WIDGET_CONFIG_DEFAULTS, createDefaultTimerWidgetConfig, resolvedTextWidgetFontFamily, normalizeTimerWidgetConfig } from "../../types";
import { TimerWidgetRenderer } from "./TimerWidgetRenderer";

export const TIMER_WIDGET_DEFAULT_SIZE = { w: 420, h: 100 } as const;

export const timerWidgetBaseDefinition: WidgetBaseDefinition<"timer_widget"> = {
  type: "timer_widget",
  defaultSize: { ...TIMER_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultTimerWidgetConfig,
  Renderer: TimerWidgetRenderer,
  collectFontFamilies: (item) => {
    const cfg = normalizeTimerWidgetConfig(item.config);
    const ff = resolvedTextWidgetFontFamily(cfg);
    return ff ? [ff] : [];
  },
};
