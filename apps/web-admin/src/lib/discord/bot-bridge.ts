import { reportError } from "@repo/sentry";
import { env } from "@/lib/env";
import { canCallInternal, internalAuthHeader } from "@/lib/internal-auth-header";

// Server-only. Calls the Discord bot's internal Hono server. Settings are
// already in the DB when these run, so a failure never undoes a save — the
// bot's cache TTLs pick the change up — but actions (panel, test welcome)
// can't happen without it.

export type BotCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "network" | "http"; status?: number; error: string };

export async function callBot<T = { ok: true }>(
  guildId: string,
  path: string,
  body: unknown = {},
  { timeoutMs = 5_000 }: { timeoutMs?: number } = {},
): Promise<BotCallResult<T>> {
  if (!env.DISCORD_BOT_INTERNAL_URL || !canCallInternal(env.DISCORD_BOT_INTERNAL_SECRET)) {
    return { ok: false, reason: "unconfigured", error: "The bot's internal API isn't configured" };
  }

  let authorization: string;
  try {
    // A service token (scope discord-guilds), signed fresh for this call.
    authorization = (await internalAuthHeader("discord-guilds", env.DISCORD_BOT_INTERNAL_SECRET))!;
  } catch (error) {
    reportError(error, "discord.bot-call.sign", { path });
    return { ok: false, reason: "unconfigured", error: "Couldn't authorize the call to the bot" };
  }

  let res: Response;
  try {
    res = await fetch(new URL(`/internal/guilds/${guildId}${path}`, env.DISCORD_BOT_INTERNAL_URL), {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    reportError(error, "discord.bot-call", { path });
    return { ok: false, reason: "network", error: "Couldn't reach the bot" };
  }

  const payload = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, reason: "http", status: res.status, error: payload.error ?? `Bot returned ${res.status}` };
  }
  return { ok: true, data: payload as T };
}

/** Toast-ready warning for a failed cache refresh after a successful save. */
export function staleWarning(result: BotCallResult<unknown>): string | null {
  if (result.ok) return null;
  return `Saved, but the bot didn't confirm (${result.error}). The change applies within a few minutes.`;
}
