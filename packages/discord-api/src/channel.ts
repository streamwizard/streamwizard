import type { DiscordMessagePayload } from "./dm";

const DISCORD_API_BASE = "https://discord.com/api/v10";

export class DiscordRateLimitError extends Error {
  constructor(public retryAfterSeconds: number) {
    super(`Discord rate limited, retry after ${retryAfterSeconds}s`);
    this.name = "DiscordRateLimitError";
  }
}

/** Discord error code 10008: the message is gone (deleted, or never there). */
export class DiscordUnknownMessageError extends Error {
  constructor(channelId: string, messageId: string) {
    super(`Discord message ${messageId} in channel ${channelId} no longer exists`);
    this.name = "DiscordUnknownMessageError";
  }
}

const UNKNOWN_MESSAGE = 10008;

async function throwForResponse(res: Response, what: string, channelId: string, messageId?: string): Promise<never> {
  if (res.status === 429) {
    const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
    throw new DiscordRateLimitError(body.retry_after ?? 1);
  }
  const text = await res.text();
  if (res.status === 404 && messageId) {
    const body = (() => {
      try {
        return JSON.parse(text) as { code?: number };
      } catch {
        return {};
      }
    })();
    if (body.code === UNKNOWN_MESSAGE) throw new DiscordUnknownMessageError(channelId, messageId);
  }
  throw new Error(`Couldn't ${what} in channel ${channelId}: ${res.status} ${text}`);
}

/**
 * Posts a message to a Discord channel via the bot's REST API — no gateway
 * connection needed, just the bot token. Throws on failure (missing channel,
 * missing Send Messages permission, …); callers that want this to be
 * best-effort should catch it. A 429 throws DiscordRateLimitError so callers
 * can honor retry_after. Resolves with the new message's id.
 */
export async function sendDiscordChannelMessage(
  channelId: string,
  payload: DiscordMessagePayload,
): Promise<{ id: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) await throwForResponse(res, "send message", channelId);
  const body = (await res.json()) as { id: string };
  return { id: body.id };
}

/**
 * Edits a message the bot posted earlier. Same rules as sending, plus a
 * DiscordUnknownMessageError when the message was deleted in the meantime,
 * so callers can treat that as "nothing to update" instead of a failure.
 * Editing never re-pings anyone, whatever the content says.
 */
export async function editDiscordChannelMessage(
  channelId: string,
  messageId: string,
  payload: DiscordMessagePayload,
): Promise<{ id: string }> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not set");

  const res = await fetch(`${DISCORD_API_BASE}/channels/${channelId}/messages/${messageId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) await throwForResponse(res, `edit message ${messageId}`, channelId, messageId);
  const body = (await res.json()) as { id: string };
  return { id: body.id };
}
