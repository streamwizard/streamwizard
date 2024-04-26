"use server";
import { CommandsTable } from "@/types/database/command";
import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";




interface CommandCreateResponse {
  error?: string;
  data?: CommandsTable;
}

// Create a new command
export async function createCommand(new_command: CommandsTable, url: string): Promise<CommandCreateResponse> {
  const supabase = createClient();
  const { data, error } = await supabase.from("commands").insert([new_command]);

  if (error) {
    console.error(error);
   return { error: error.message };
  }
  revalidatePath(url);
  return {
    data: new_command,
  };
}

interface CommandUpdateResponse {
  error?: string;
  data?: CommandsTable;
}

// Update a command
export async function updateCommand(command: CommandsTable, url: string): Promise<CommandUpdateResponse> {
  const supabase = createClient();
  const { error } = await supabase
    .from("commands")
    .update({ ...command })
    .eq("id", command.id);

  if (error) {
    revalidatePath(url);
    throw new Error(error.message);
  }

  revalidatePath(url);
  return { data: command };
}

// get all commands
export async function getCommands(): Promise<CommandsTable[]> {
  const supabase = createClient();
  const { data, error } = await supabase.from("commands").select("*");

  if (error) {
    console.error(error);
    return [];
  }

  return data as CommandsTable[];
}


interface CommandDeleteResponse {
  error?: string;
  removedRows?: number;
}


// delete a command
export async function deleteCommands(command_id: string, url: string): Promise<CommandDeleteResponse> {
  const supabase = createClient();

  const { error, count } = await supabase.from("commands").delete().eq("id", command_id)

  if (error) {
    console.log(error);
    revalidatePath(url);
    throw new Error(error.message);
  }

  revalidatePath(url);
  return { removedRows: count!};
}