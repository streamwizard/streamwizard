import { ChannelChatMessageEventSchema } from "@repo/schemas/eventsub/chat";
import type { HandlerRegistry } from "./eventHandler";
import { handleChatMessage } from "./eventsub/handleChatMessage";

export const registerTwitchHandlers = (handlers: HandlerRegistry) => {
  handlers.registerTwitchHandler(
    "channel.chat.message",
    async (event, context) => {
      await handleChatMessage(event, context.twitchApi);
    },
    ChannelChatMessageEventSchema,
  );
};
