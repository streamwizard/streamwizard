import { handleStreamOffline } from "../functions/twitch-eventsub-events/stream-offline";
import * as TwitchSchema from "@repo/schemas";
import type { HandlerRegistry } from "./eventHandler";
import { handleStreamOnline } from "../functions/twitch-eventsub-events/stream-online";
import { handleChannelUpdate } from "../functions/twitch-eventsub-events/channel-update";

export const registerTwitchHandlers = (handlers: HandlerRegistry) => {
  // stream offline event
  handlers.registerTwitchHandler(
    "stream.offline",
    async (event: TwitchSchema.StreamOfflineEvent, context) => {
      handleStreamOffline(event, context.twitchApi);
    },
    TwitchSchema.StreamOfflineEventSchema,
  );

  // stream online event
  handlers.registerTwitchHandler(
    "stream.online",
    async (event: TwitchSchema.StreamOnlineEvent, context) => {
      handleStreamOnline(event, context.twitchApi);
    },
    TwitchSchema.StreamOnlineEventSchema,
  );

  // channel update event
  handlers.registerTwitchHandler(
    "channel.update",
    async (event, context) => {
      handleChannelUpdate(event, context.twitchApi);
    },
    TwitchSchema.ChannelUpdateEventSchema,
  );
};
