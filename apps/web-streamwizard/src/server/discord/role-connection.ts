import { env } from "@/lib/env";

// Sets the caller's role-connection metadata for this app, which is what
// makes Discord grant/revoke the verified Linked Role on their profile.
// Pass `linked: true` when the account is connected, `false` to revoke.
// The access token must carry the `role_connections.write` scope.
export async function setDiscordRoleConnection(
  accessToken: string,
  platformUsername: string,
  linked: boolean
) {
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
        metadata: { linked: linked ? "true" : "false" },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Discord role-connection update failed: ${response.status} ${await response.text()}`);
  }
}
