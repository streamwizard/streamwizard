const DISCORD_API_BASE = "https://discord.com/api/v10";

export interface DiscordMessagePayload {
  content: string;
}

/**
 * Sends a direct message to a Discord user via the bot's REST API — no
 * gateway connection needed, just the bot token. Throws on failure (e.g. the
 * user has DMs from server members disabled, or doesn't share a guild with
 * the bot); callers that want this to be best-effort should catch it.
 */
export async function sendDiscordDirectMessage(
  discordUserId: string,
  payload: DiscordMessagePayload,
): Promise<void> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const channelRes = await fetch(`${DISCORD_API_BASE}/users/@me/channels`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ recipient_id: discordUserId }),
  });
  if (!channelRes.ok) {
    throw new Error(`Couldn't open a DM channel with ${discordUserId}: ${channelRes.status} ${await channelRes.text()}`);
  }
  const channel = (await channelRes.json()) as { id: string };

  const messageRes = await fetch(`${DISCORD_API_BASE}/channels/${channel.id}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!messageRes.ok) {
    throw new Error(`Couldn't send DM to ${discordUserId}: ${messageRes.status} ${await messageRes.text()}`);
  }
}
