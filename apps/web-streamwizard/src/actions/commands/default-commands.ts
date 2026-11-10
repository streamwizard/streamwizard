"use server";
import { guidSchema } from "@repo/schemas/ids";
import { toggleDefaultCommand as _toggleDefaultCommand } from "@repo/supabase/queries/twitch/commands";
import { revalidatePath } from "next/cache";
import { reportError } from "@repo/sentry";
import { tryAuthContext } from "@/lib/auth";
import { toggleDefaultCommandSchema } from "@/schemas/commands";

export async function toggleDefaultCommand(defaultCommandId: string, enabled: boolean) {
  const ctx = await tryAuthContext();
  if (!ctx) return false;
  const parsed = toggleDefaultCommandSchema.safeParse({ defaultCommandId, enabled });
  if (!parsed.success) return false;

  try {
    await _toggleDefaultCommand(ctx.supabase, ctx.broadcasterId, parsed.data.defaultCommandId, parsed.data.enabled);
  } catch (error) {
    reportError(error, "actions/default-commands.toggle");
    return false;
  }
  revalidatePath("/dashboard/default-commands");
  return true;
}

export async function duplicateToCustomCommand(defaultCommandId: string) {
  // TODO: Implement duplication to custom commands table
  const ctx = await tryAuthContext();
  if (!ctx) return false;
  const parsed = guidSchema.safeParse(defaultCommandId);
  if (!parsed.success) return false;

  console.log("Duplicating command to custom commands:", parsed.data, ctx.broadcasterId);
  revalidatePath("/dashboard/default-commands");
  return true;
}
