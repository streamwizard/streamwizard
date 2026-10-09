import type { WidgetBaseDefinition } from "../../widget-definition";
import {
  IMAGE_WIDGET_TYPE,
  VIDEO_WIDGET_TYPE,
  createDefaultImageWidgetConfig,
  createDefaultVideoWidgetConfig,
} from "./media-widget-config";
import { ImageWidgetRenderer, VideoWidgetRenderer } from "./MediaWidgetRenderer";

export const IMAGE_WIDGET_DEFAULT_SIZE = { w: 400, h: 300 } as const;
export const VIDEO_WIDGET_DEFAULT_SIZE = { w: 640, h: 360 } as const;

export const imageWidgetBaseDefinition: WidgetBaseDefinition<typeof IMAGE_WIDGET_TYPE> = {
  type: IMAGE_WIDGET_TYPE,
  defaultSize: { ...IMAGE_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultImageWidgetConfig,
  Renderer: ImageWidgetRenderer,
};

export const videoWidgetBaseDefinition: WidgetBaseDefinition<typeof VIDEO_WIDGET_TYPE> = {
  type: VIDEO_WIDGET_TYPE,
  defaultSize: { ...VIDEO_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultVideoWidgetConfig,
  Renderer: VideoWidgetRenderer,
};
