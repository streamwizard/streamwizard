import type { WidgetBaseDefinition } from "../../widget-definition";
import { createDefaultChatWidgetConfig, normalizeChatWidgetConfig } from "./chat-widget-config";
import { ChatWidgetRenderer } from "./ChatWidgetRenderer";

export const CHAT_WIDGET_DEFAULT_SIZE = { w: 420, h: 600 } as const;

export const chatWidgetBaseDefinition: WidgetBaseDefinition<"chat_widget"> = {
  type: "chat_widget",
  defaultSize: { ...CHAT_WIDGET_DEFAULT_SIZE },
  createDefaultConfig: createDefaultChatWidgetConfig,
  Renderer: ChatWidgetRenderer,
  collectFontFamilies: (item) => [normalizeChatWidgetConfig(item.config).fontFamily],
};
