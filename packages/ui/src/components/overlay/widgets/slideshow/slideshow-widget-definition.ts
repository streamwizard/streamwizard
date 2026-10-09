import type { WidgetBaseDefinition } from "../../widget-definition";
import { SLIDESHOW_WIDGET_TYPE, createDefaultSlideshowWidgetConfig } from "./slideshow-widget-config";
import { SlideshowWidgetRenderer } from "./SlideshowWidgetRenderer";

export const SLIDESHOW_WIDGET_DEFAULT_SIZE = { w: 400, h: 300 } as const;

export const slideshowWidgetBaseDefinition: WidgetBaseDefinition<typeof SLIDESHOW_WIDGET_TYPE> = {
  type: SLIDESHOW_WIDGET_TYPE,
  defaultSize: { ...SLIDESHOW_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultSlideshowWidgetConfig,
  Renderer: SlideshowWidgetRenderer,
};
