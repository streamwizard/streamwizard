"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { CommandTable } from "@/types/supabase";




interface CommandCreateResponse {
  error?: string;
  data?: CommandTable;
}

// Create a new command
export async function createCommand(new_command: CommandTable, url: string): Promise<CommandCreateResponse> {
  const session = await auth();
  
  const supabase = createClient(session?.supabaseAccessToken as string);
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
  data?: CommandTable;
}

// Update a command
export async function updateCommand(command: CommandTable, url: string): Promise<CommandTable> {
  const session = await auth();
  
  const supabase = createClient(session?.supabaseAccessToken as string);
  const { error } = await supabase
    .from("commands")
    .update({ ...command })
    .eq("id", command.id);

  if (error) {
    revalidatePath(url);
    throw new Error(error.message);
  }

  revalidatePath(url);
  return command;
}

// get all commands
export async function getCommands() {
  const session = await auth();

  console.log(session?.supabaseAccessToken);
  
  const supabase = createClient(session?.supabaseAccessToken as string);

  const { data, error } = await supabase.from("commands").select("*");

  if (error) {
    console.error(error);
    return [];
  }

  return data 
}


interface CommandDeleteResponse {
  error?: string;
  removedRows?: number;
}


// delete a command
export async function deleteCommands(command_id: string, url: string): Promise<CommandDeleteResponse> {
  const session = await auth();
  
  const supabase = createClient(session?.supabaseAccessToken as string);

  const { error, count } = await supabase.from("commands").delete().eq("id", command_id)

  if (error) {
    console.log(error);
    revalidatePath(url);
    throw new Error(error.message);
  }

  revalidatePath(url);
  return { removedRows: count!};
}