import { ApplicationRoleConnectionMetadataType, REST, Routes } from "discord.js";
import { env } from "../lib/env";

// One-time setup: registers the app's Linked Roles metadata schema with
// Discord. Re-run this whenever the metadata fields below change — it is
// NOT run automatically at bot boot.
async function main() {
  const rest = new REST().setToken(env.DISCORD_BOT_TOKEN);

  await rest.put(Routes.applicationRoleConnectionMetadata(env.DISCORD_CLIENT_ID), {
    body: [
      {
        key: "linked",
        name: "Linked StreamWizard Account",
        description: "Has connected their StreamWizard account",
        type: ApplicationRoleConnectionMetadataType.BooleanEqual,
      },
    ],
  });

  console.log("[register-role-connection-metadata] Done.");
}

main().catch((error) => {
  console.error("❌ Failed to register role connection metadata:", error);
  process.exit(1);
});
