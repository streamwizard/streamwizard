import { Events } from "discord.js";
import { emitServerEvent } from "../../lib/server-log/emit";
import { serverLogEvent } from "../../lib/server-log/handler";
import { channelRef, memberRef } from "../../lib/server-log/refs";

// Off by default: busy servers generate a lot of these. Mute and deafen
// changes also arrive here and are ignored.
export default serverLogEvent(Events.VoiceStateUpdate, async (oldState, newState) => {
  if (oldState.channelId === newState.channelId) return;
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;
  const guild = newState.guild;
  const options = { subjectDiscordId: member.id };

  if (!oldState.channelId && newState.channel) {
    await emitServerEvent(
      guild,
      "voice.joined",
      { member: memberRef(member), channel: channelRef(newState.channel)! },
      options,
    );
  } else if (oldState.channel && !newState.channelId) {
    await emitServerEvent(
      guild,
      "voice.left",
      { member: memberRef(member), channel: channelRef(oldState.channel)! },
      options,
    );
  } else if (oldState.channelId && newState.channelId) {
    await emitServerEvent(
      guild,
      "voice.moved",
      {
        member: memberRef(member),
        from: channelRef(oldState.channel, oldState.channelId)!,
        to: channelRef(newState.channel, newState.channelId)!,
      },
      options,
    );
  }
});
