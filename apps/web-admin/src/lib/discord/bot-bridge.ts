import { reportError } from "@repo/sentry";
import { env } from "@/lib/env";

// Server-only. Calls the Discord bot's internal Hono server. Settings are
// already in the DB when these run, so a failure never undoes a save — the
// bot's cache TTLs pick the change up — but actions (panel, test welcome)
// can't happen without it.

export type BotCallResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "unconfigured" | "network" | "http"; status?: number; error: string };

export async function callBot<T = { ok: true }>(guildId: string, path: string, body: unknown = {}): Promise<BotCallResult<T>> {
  if (!env.DISCORD_BOT_INTERNAL_URL || !env.DISCORD_BOT_INTERNAL_SECRET) {
    return { ok: false, reason: "unconfigured", error: "The bot's internal API isn't configured" };
  }

  let res: Response;
  try {
    res = await fetch(new URL(`/internal/guilds/${guildId}${path}`, env.DISCORD_BOT_INTERNAL_URL), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.DISCORD_BOT_INTERNAL_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });
  } catch (error) {
    reportError(error, "web-admin discord: bot call", { path });
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
