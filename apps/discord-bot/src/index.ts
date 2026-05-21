import { env } from "./lib/env";
import { client } from "./client";
import { handleCommand } from "./commands/index.ts";
import { handleModal } from "./modals/index.ts";

client.on("interactionCreate", async (interaction) => {
  if (interaction.isChatInputCommand()) {
    await handleCommand(interaction);
  }

  if (interaction.isModalSubmit()) {
    await handleModal(interaction);
  }
});

client.once("clientReady", () => {
  console.log(`✅ Logged in as ${client.user?.tag}`);
});

client.login(env.DISCORD_TOKEN);
