import { env } from "@/lib/env";

// Sets the caller's role-connection metadata for this app, which is what
// makes Discord show a verified Linked Role on their profile. Best-effort:
// the account link itself already succeeded by the time this is called, so
// a failure here shouldn't fail the whole flow.
export async function setDiscordRoleConnection(accessToken: string, platformUsername: string) {
  const response = await fetch(
    `https://discord.com/api/v10/users/@me/applications/${env.DISCORD_CLIENT_ID}/role-connection`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        platform_name: "StreamWizard",
        platform_username: platformUsername,
        metadata: { linked: "true" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Discord role-connection update failed: ${response.status} ${await response.text()}`);
  }
}
