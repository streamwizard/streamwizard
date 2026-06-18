import { Client, Collection, GatewayIntentBits } from "discord.js";

// Start with the minimal intent set. Add more (e.g. GuildMessages +
// MessageContent) only when a feature actually needs them — each one
// requires re-approval in the Discord developer portal for verified bots.
// GuildMembers is privileged and required for the GuildMemberAdd welcome message.
export const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

client.commands = new Collection();
