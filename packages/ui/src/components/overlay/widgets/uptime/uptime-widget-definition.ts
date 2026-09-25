import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  UPTIME_WIDGET_TYPE,
  createDefaultUptimeWidgetConfig,
  normalizeUptimeWidgetConfig,
} from "./uptime-widget-config";
import { UptimeWidgetRenderer } from "./UptimeWidgetRenderer";

export const UPTIME_WIDGET_DEFAULT_SIZE = { w: 360, h: 72 } as const;

export const uptimeWidgetBaseDefinition: WidgetBaseDefinition<typeof UPTIME_WIDGET_TYPE> = {
  type: UPTIME_WIDGET_TYPE,
  defaultSize: { ...UPTIME_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultUptimeWidgetConfig,
  Renderer: UptimeWidgetRenderer,
  collectFontFamilies: (item) => [normalizeUptimeWidgetConfig(item.config).fontFamily],
};
