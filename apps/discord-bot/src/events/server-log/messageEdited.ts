import { Events } from "discord.js";
import { emitServerEvent, shouldLogMessage } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef, messageText, userRef } from "../../lib/server-log/refs";

// Discord also sends MessageUpdate when a link preview unfurls or a message is
// pinned; only real text edits are logged. The old text is only known when the
// message was cached (sent or seen since the bot's last restart).
export default serverLogEvent(Events.MessageUpdate, async (oldMessage, newMessage) => {
  const message = newMessage.partial ? await newMessage.fetch().catch(() => null) : newMessage;
  if (!message?.guild) return;
  // Discord stamps edited_timestamp only for real edits, not unfurls or pins.
  if (!message.editedTimestamp) return;
  if (!oldMessage.partial && oldMessage.editedTimestamp === message.editedTimestamp) return;
  const before = oldMessage.partial ? null : oldMessage.content;
  if (before !== null && before === message.content) return;
  if (!(await shouldLogMessage(message.guild, message))) return;

  await emitServerEvent(
    message.guild,
    "message.edited",
    {
      member: userRef(message.author, message.member) ?? { id: message.author.id },
      channel: channelRef(message.channel.isDMBased() ? null : message.channel, message.channelId)!,
      message_id: message.id,
      url: message.url,
      before: messageText(before),
      after: messageText(message.content),
    },
    { subjectDiscordId: message.author.id },
  );
});
