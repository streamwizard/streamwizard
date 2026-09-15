import { Client, Collection, GatewayIntentBits, Partials } from "discord.js";

// Privileged intents (turn them on in the Discord developer portal):
//   GuildMembers    welcome messages, join role, member log events
//   MessageContent  message text for the server log (edits, deletes) and
//                   ticket transcripts
// Not privileged:
//   GuildMessages, GuildMessageReactions, GuildVoiceStates  activity tracker
//   GuildModeration  ban events and the audit log (who did it)
//   GuildInvites     invite log events
// The activity tracker still only counts messages; message text is used for
// the server log and transcripts only.
//
// Partials let events fire for things the bot hasn't cached: reactions on old
// messages, deletes of old messages, members who left before a restart.
export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildInvites,
  ],
  partials: [Partials.Message, Partials.Reaction, Partials.Channel, Partials.GuildMember, Partials.User],
});

client.commands = new Collection();
