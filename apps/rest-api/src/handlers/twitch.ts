import { reportError } from "@repo/sentry";
import { handleStreamOffline } from "../functions/twitch-eventsub-events/stream-offline";
import * as TwitchSchema from "@repo/schemas";
import type { HandlerRegistry } from "./eventHandler";
import { handleStreamOnline } from "../functions/twitch-eventsub-events/stream-online";
import { handleChannelUpdate } from "../functions/twitch-eventsub-events/channel-update";
import { handleUserAuthorizationRevoke } from "../functions/twitch-eventsub-events/user-authorization-revoke";

/**
 * The long handlers (clip sync on stream.offline can page through thousands of
 * clips) run detached so the webhook answers Twitch within its timeout. A
 * detached promise that rejects only reaches Sentry as a bare
 * unhandledRejection, so give each one a context tag and the broadcaster.
 */
const detached = (context: string, broadcasterUserId: string, work: Promise<void>) => {
  work.catch((error) => reportError(error, context, { broadcasterUserId }));
};

export const registerTwitchHandlers = (handlers: HandlerRegistry) => {
  // stream offline event
  handlers.registerTwitchHandler(
    "stream.offline",
    async (event: TwitchSchema.StreamOfflineEvent, context) => {
      detached("eventsub.stream-offline", event.broadcaster_user_id, handleStreamOffline(event, context.twitchApi));
    },
    TwitchSchema.StreamOfflineEventSchema,
  );

  // stream online event
  handlers.registerTwitchHandler(
    "stream.online",
    async (event: TwitchSchema.StreamOnlineEvent, context) => {
      detached("eventsub.stream-online", event.broadcaster_user_id, handleStreamOnline(event, context.twitchApi));
    },
    TwitchSchema.StreamOnlineEventSchema,
  );

  // channel update event
  handlers.registerTwitchHandler(
    "channel.update",
    async (event, context) => {
      detached("eventsub.channel-update", event.broadcaster_user_id, handleChannelUpdate(event, context.twitchApi));
    },
    TwitchSchema.ChannelUpdateEventSchema,
  );

  // GDPR: delete all user data when a user revokes app authorization
  handlers.registerTwitchHandler(
    "user.authorization.revoke",
    async (event) => {
      await handleUserAuthorizationRevoke(event);
    },
    TwitchSchema.UserAuthorizationRevokeEventSchema,
  );
};
