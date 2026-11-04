import { TwitchApi } from "@repo/twitch-api";
import { supabase } from "@repo/supabase";
import { reportError } from "@repo/sentry";
import { getEnabledCommandsByChannel } from "@repo/supabase/queries/commands";
import type { ChannelChatMessageEvent } from "@repo/schemas";
import { createCommandLookup, type MatchedCommand } from "../../functions/commandLookup";
import { resolveVariables } from "../../functions/resolveVariables";
import { recordChatCommand } from "../../functions/trackChatCommand";

const commandLookup = createCommandLookup((channelId) => getEnabledCommandsByChannel(supabase, channelId));

export async function handleChatMessage(message: ChannelChatMessageEvent, twitchApi: TwitchApi) {
  // split the message into parts
  const parts = message.message.text.split(" ");

  // get the command
  const command = parts[0];

  if (!command) return;

  let returnMessage: string = "";
  let action: string | null = null;
  if (command.startsWith("!")) {
    let match: MatchedCommand | null;
    try {
      match = await commandLookup.find(message.broadcaster_user_id, command);
    } catch (error) {
      reportError(error, "chat-message.load-commands", {
        broadcaster_user_id: message.broadcaster_user_id,
      });
      return;
    }

    if (!match) {
      return;
    }

    const commandData = match.data;
    recordChatCommand(message.broadcaster_user_id, match.source, command);

    returnMessage = commandData.message || "";
    action = commandData.action || "";



    const historyResults: Record<string, any> = {
      [commandData.id]: message,
    };
    const resolvedMessage = await resolveVariables(returnMessage, { twitchApi }, historyResults);


    // send the message to the broadcaster chat
    if (returnMessage) {
      await twitchApi.chat.sendMessage({
        message: resolvedMessage,
        replyToMessageId: message.message_id,
      });
    }
  }
}
