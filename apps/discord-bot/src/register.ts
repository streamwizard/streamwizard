import { env } from "./lib/env";
import { ApplicationCommandOptionType, REST, Routes } from "discord.js";

const commands = [
  {
    name: "ping",
    description: "Replies with Pong!",
  },
  {
    name: "ticket",
    description: "Create a support ticket",
    options: [
      {
        name: "category",
        description: "What type of ticket is this?",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "🐛 Bug Report", value: "bug" },
          { name: "✨ Feature Request", value: "feature" },
          { name: "💬 General", value: "general" },
        ],
      },
      {
        name: "priority",
        description: "How urgent is this?",
        type: ApplicationCommandOptionType.String,
        required: true,
        choices: [
          { name: "🟢 Low", value: "low" },
          { name: "🟡 Medium", value: "medium" },
          { name: "🟠 High", value: "high" },
          { name: "🔴 Critical", value: "critical" },
        ],
      },
    ],
  },
];

const rest = new REST({ version: "10" }).setToken(env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Started refreshing application (/) commands.");

    // Use applicationGuildCommands for instant updates in your test server
    await rest.put(Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, "1052205042490429500"), { body: commands });

    console.log("Successfully reloaded application (/) commands.");
  } catch (error) {
    console.error(error);
  }
})();
