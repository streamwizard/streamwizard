"use server";
import { createClient } from "@repo/supabase/next/server";
import { getUserChannelId } from "@repo/supabase/queries/user";
import {
  getDefaultCommandsWithStatus as _getDefaultCommandsWithStatus,
  toggleDefaultCommand as _toggleDefaultCommand,
} from "@repo/supabase/queries/commands";
import { revalidatePath } from "next/cache";

export async function listDefaultCommands() {
  const supabase = await createClient();
  const channelId = await getUserChannelId(supabase);
  return _getDefaultCommandsWithStatus(supabase, channelId);
}

export async function toggleDefaultCommand(defaultCommandId: string, enabled: boolean) {
  const supabase = await createClient();
  const channelId = await getUserChannelId(supabase);
  await _toggleDefaultCommand(supabase, channelId, defaultCommandId, enabled);
  revalidatePath("/dashboard/default-commands");
  return true;
}

export async function duplicateToCustomCommand(defaultCommandId: string) {
  // TODO: Implement duplication to custom commands table
  const supabase = await createClient();
  const channelId = await getUserChannelId(supabase);
  console.log("Duplicating command to custom commands:", defaultCommandId, channelId);
  revalidatePath("/dashboard/default-commands");
  return true;
}
