"use client";
import { createCommand, deleteCommands, updateCommand as update } from "@/actions/supabase/table-commands";
import { CommandSchemaType } from "@/schemas/command-schema";
import React, { ReactNode, createContext, startTransition, useOptimistic } from "react";
import { toast } from "sonner";
import { CommandTable, InsertCommandTable, UpdateCommandsTable } from "@/types/database";

// Define the type for the context
export interface CommandContextType {
  commands: CommandTable[];
  addCommand: (command: CommandSchemaType) => void;
  updateCommand: (command: UpdateCommandsTable) => void;
  deleteCommand: (commands: CommandTable[]) => void;
}

// Create the context with TypeScript type
export const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface Props {
  children: ReactNode;
  initialCommands: CommandTable[];
  user_id: string;
  broadcaster_id: string;
  editor: string;
}

function reducer(state: CommandTable[], action: { type: string; payload: CommandTable }) {
  switch (action.type) {
    case "ADD_COMMAND":
      return [...state, action.payload];
    case "UPDATE_COMMAND":
      return state.map((c) => (c.id === action.payload.id ? action.payload : c));
    case "DELETE_COMMAND":
      return state.filter((c) => c.id !== action.payload.id);
    default:
      return state;
  }
}

export const CommandProvider = ({ children, initialCommands, broadcaster_id, editor, user_id }: Props) => {
  // const [commands, setCommands] = React.useState<CommandsTable[]>(initialCommands);
  const [optimisticCommands, dispatch] = useOptimistic(initialCommands, reducer);

  // Function to add a command
  const addCommand = async (command: CommandSchemaType) => {
    // TODO: fix type
    // @ts-ignore
    const new_command: CommandTable = {
      ...command,
      broadcaster_id: +broadcaster_id,
      user_id: user_id,
      updated_by: editor,
      updated_at: new Date().toDateString(),
    };

    startTransition(() => {
      dispatch({ type: "ADD_COMMAND", payload: new_command });
    });

    toast.promise(createCommand(new_command, "/dashboard/commands"), {
      loading: "Adding command...",
      success: `Command ${command.command} added successfully`,
      error: (error) => error,
    });


  };

  // Function to update a command
  const updateCommand = async (command: CommandTable) => {
    startTransition(() => {
      dispatch({ type: "UPDATE_COMMAND", payload: command });
    });
    
    toast.promise(update(command, "/dashboard/commands"), {
      loading: "Updating command...",
      success: `Command ${command.command} updated successfully`,
      error: (error) => error,
    });

  };

  // Function to delete a command
  const deleteCommand = async (commands: CommandTable[]) => {
    startTransition(() => {
      commands.forEach((command) => {
        dispatch({ type: "DELETE_COMMAND", payload: command });
      });
    });

    const command_ids = commands.map((c) => c.id).filter((id) => id !== undefined) as string[];

    command_ids.forEach(async (id) => {
      const { error, removedRows } = await deleteCommands(id, "/dashboard/commands");

      if (error) {
        toast.error(error);
        return;
      }

      if (removedRows) {
        toast.success(`Successfully deleted ${removedRows} commands`);
      }
    });
  };

  // Value that will be passed to context consumers
  const value = { commands: optimisticCommands, addCommand, updateCommand, deleteCommand };

  return <CommandContext.Provider value={value}>{children}</CommandContext.Provider>;
};
