import type { WidgetBaseDefinition } from "../../widget-definition";
import { EMOTE_WIDGET_TYPE, createDefaultEmoteWidgetConfig } from "./emote-widget-config";
import { EmoteWidgetRenderer } from "./EmoteWidgetRenderer";

/** The whole scene: emotes fly anywhere. */
export const EMOTE_WIDGET_DEFAULT_SIZE = { w: 1920, h: 1080 } as const;

export const emoteWidgetBaseDefinition: WidgetBaseDefinition<typeof EMOTE_WIDGET_TYPE> = {
  type: EMOTE_WIDGET_TYPE,
  defaultSize: { ...EMOTE_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultEmoteWidgetConfig,
  Renderer: EmoteWidgetRenderer,
  collectFontFamilies: () => [],
};
