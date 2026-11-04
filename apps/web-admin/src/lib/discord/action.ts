import { revalidatePath } from "next/cache";
import { z } from "zod";
import { guidSchema } from "@repo/schemas/ids";
import { reportError } from "@repo/sentry";
import { ActionError, errorTag, toActionError as toSharedActionError, type ActionResult } from "@/lib/actions/action-error";
import { requireAdmin } from "@/lib/auth/admin-context";
import { requireDiscordContext, type DiscordContext } from "./api";
import { callBot, staleWarning } from "./bot-bridge";
import { DashboardError } from "./errors";

export { DashboardError };

// Shared plumbing for the Discord dashboard's server actions.

export interface DiscordActionResult extends ActionResult {
  /** Set when the save landed but the bot couldn't confirm it. */
  warning?: string | null;
}

/** Admin check plus Discord config, for the top of every Discord action. */
export async function requireDiscordAdmin(): Promise<DiscordContext & { userId: string }> {
  const userId = await requireAdmin();
  try {
    return { userId, ...requireDiscordContext() };
  } catch (error) {
    throw new DashboardError(error instanceof Error ? error.message : "Not authorized");
  }
}

/** Toast-safe result for a caught error; unexpected ones go to Sentry. */
export function toActionError(error: unknown, context: string, fallback: string): DiscordActionResult {
  return toSharedActionError(error, errorTag("discord", context), fallback);
}

/** For read actions that answer with an empty value instead of `{ error }`:
 * a refused admin check or bad input is no incident, anything else is reported. */
export function reportUnexpected(error: unknown, context: string): void {
  if (!(error instanceof ActionError)) reportError(error, errorTag("discord", context));
}

/** Parses action input; a refusal becomes a DashboardError, so the action's
 * catch shows it and nothing else runs. The message is `message` when given,
 * otherwise the first issue's (the schemas word theirs for the form). */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown, message?: string): z.output<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new DashboardError(message ?? parsed.error.issues[0]?.message ?? "Check the fields and try again.");
  return parsed.data;
}

/** A database id from the caller. A bad one is the caller's mistake, not an
 * incident: it becomes the section's "doesn't exist anymore" message. */
export function parseId(id: unknown, gone: string): string {
  const parsed = guidSchema.safeParse(id);
  if (!parsed.success) throw new DashboardError(gone);
  return parsed.data;
}

const orderSchema = z.array(guidSchema).max(200);

/** The ids of a reordered list, in their new order. */
export function parseOrder(orderedIds: unknown): string[] {
  return parseInput(orderSchema, orderedIds, "That order can't be saved. Refresh the page?");
}

/** "[a], [b]" or "{a}, {b}", for an unknown-placeholder message. */
export function listPlaceholders(names: readonly string[], brackets: "[]" | "{}"): string {
  return names.map((name) => `${brackets[0]}${name}${brackets[1]}`).join(", ");
}

/** The usual ending of a save: revalidate the dashboard and ask the bot to drop
 * its cached copy. A failed refresh is a warning; the save already landed. */
export async function refreshBotCache(guildId: string, cachePath: string): Promise<DiscordActionResult> {
  revalidatePath("/discord", "layout");
  return { error: null, warning: staleWarning(await callBot(guildId, cachePath)) };
}
