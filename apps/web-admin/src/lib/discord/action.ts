import { reportError } from "@repo/sentry";
import { assertAdmin } from "@/lib/assert-admin";
import { requireDiscordContext, type DiscordContext } from "./api";
import { DashboardError } from "./errors";

export { DashboardError };

// Shared plumbing for the Discord dashboard's server actions.

export interface DiscordActionResult {
  error: string | null;
  /** Set when the save landed but the bot couldn't confirm it. */
  warning?: string | null;
}

/** Admin check plus Discord config, for the top of every Discord action. */
export async function requireDiscordAdmin(): Promise<DiscordContext & { userId: string }> {
  try {
    const userId = await assertAdmin();
    return { userId, ...requireDiscordContext() };
  } catch (error) {
    throw new DashboardError(error instanceof Error ? error.message : "Not authorized");
  }
}

/** Toast-safe result for a caught error; unexpected ones go to Sentry. */
export function toActionError(error: unknown, context: string, fallback: string): DiscordActionResult {
  if (error instanceof DashboardError) return { error: error.message };
  reportError(error, `web-admin discord: ${context}`);
  return { error: fallback };
}
