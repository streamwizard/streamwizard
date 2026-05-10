"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";


async function getUserChannelId() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  
  if (userError || !userData.user) {
    throw new Error("User not authenticated");
  }

  const { data: twitchData, error: twitchError } = await supabase
    .from("integrations_twitch")
    .select("twitch_user_id")
    .eq("user_id", userData.user.id)
    .single();

  if (twitchError || !twitchData) {
    throw new Error("Twitch integration not found");
  }

  return twitchData.twitch_user_id;
}

export async function listDefaultCommands() {
  const supabase = await createClient();
  const channelId = await getUserChannelId();
  
  // Fetch all default commands
  const { data: defaultCommands, error: defaultError } = await supabase
    .from("default_chat_commands")
    .select("*")
    .order("command", { ascending: true });
  
  if (defaultError) {
    console.error("Error fetching default commands:", defaultError);
    throw new Error("Failed to fetch default commands");
  }

  // Fetch user's channel commands to get enabled status
  const { data: channelCommands, error: channelError } = await supabase
    .from("commands")
    .select("default_command_id, enabled, id")
    .eq("channel_id", channelId);

  if (channelError) {
    console.error("Error fetching channel commands:", channelError);
  }

  // Create a map of default_command_id to enabled status and command id
  const enabledMap = new Map(
    channelCommands?.map(cmd => [cmd.default_command_id, { enabled: cmd.enabled, commandId: cmd.id }]) || []
  );

  // Merge the data
  const commandsWithStatus = defaultCommands.map(defaultCmd => ({
    ...defaultCmd,
    enabled: enabledMap.get(defaultCmd.id)?.enabled ?? false,
    channelCommandId: enabledMap.get(defaultCmd.id)?.commandId,
  }));
  
  return commandsWithStatus;
}

export async function toggleDefaultCommand(defaultCommandId: string, enabled: boolean) {
  const supabase = await createClient();
  const channelId = await getUserChannelId();
  
  // Check if a channel command already exists for this default command
  const { data: existingCommand } = await supabase
    .from("commands")
    .select("id")
    .eq("channel_id", channelId)
    .eq("default_command_id", defaultCommandId)
    .single();

  if (existingCommand) {
    // Update existing command
    const { error } = await supabase
      .from("commands")
      .update({ enabled })
      .eq("id", existingCommand.id);
    
    if (error) {
      console.error("Error updating command:", error);
      throw new Error("Failed to update command");
    }
  } else {
    // Create new channel command instance
    const { error } = await supabase
      .from("commands")
      .insert({
        channel_id: channelId,
        default_command_id: defaultCommandId,
        enabled,
      });
    
    if (error) {
      console.error("Error creating command:", error);
      throw new Error("Failed to create command");
    }
  }
  
  revalidatePath("/dashboard/default-commands");
  return true;
}

export async function duplicateToCustomCommand(defaultCommandId: string) {
  // TODO: Implement duplication to custom commands table
  // This will create a custom command based on the default command
  // that the user can then fully edit, update, and delete
  const channelId = await getUserChannelId();
  
  // Placeholder implementation
  console.log("Duplicating command to custom commands:", defaultCommandId, channelId);
  
  revalidatePath("/dashboard/default-commands");
  return true;
}

