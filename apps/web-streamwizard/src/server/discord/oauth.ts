import { env } from "@/lib/env";

// Exchanges a stored Discord refresh token for a fresh access token. Supabase
// only hands us the provider token at link time and never refreshes it, so we
// refresh directly against Discord (requires the client secret) when we need a
// valid token later — e.g. to revoke the Linked Role on disconnect.
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const response = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.DISCORD_CLIENT_ID,
      client_secret: env.DISCORD_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`Discord token refresh failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Discord token refresh returned no access_token");
  }

  return data.access_token;
}
