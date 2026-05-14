import type { WidgetBaseDefinition } from "../../widget-definition";
import { DEFAULT_CLIPS_WIDGET_ITEM_CONFIG } from "../../types";

export const CLIPS_WIDGET_DEFAULT_SIZE = { w: 1920, h: 1080 } as const;

/**
 * Base definition for clips_widget.
 * Renderer is intentionally omitted here — each app provides its own container
 * that wraps ClipsWidgetRenderer with app-specific data fetching.
 * (web-overlay: ClipsWidgetContainer, web-streamwizard: ClipsWidgetCanvas)
 */
export const clipsWidgetBaseDefinition: WidgetBaseDefinition<"clips_widget"> = {
  type: "clips_widget",
  defaultSize: { ...CLIPS_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: () => ({ ...DEFAULT_CLIPS_WIDGET_ITEM_CONFIG }),
};
