"use client";
import { createCommand, deleteCommands, updateCommand as update } from "@/actions/supabase/table-commands";
import { CommandSchemaType } from "@/schemas/command-schema";
import { CommandsTable } from "@/types/database/command";
import React, { ReactNode, createContext, startTransition, useOptimistic } from "react";
import { toast } from "sonner";

// Define the type for the context
export interface CommandContextType {
  commands: CommandsTable[];
  addCommand: (command: CommandSchemaType) => void;
  updateCommand: (command: CommandsTable) => void;
  deleteCommand: (commands: CommandsTable[]) => void;
}

// Create the context with TypeScript type
export const CommandContext = createContext<CommandContextType | undefined>(undefined);

interface Props {
  children: ReactNode;
  initialCommands: CommandsTable[];
  user_id: string;
  channel_id: number;
  editor: string;
}

function reducer(state: CommandsTable[], action: { type: string; payload: CommandsTable }) {
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

export const CommandProvider = ({ children, initialCommands, channel_id, editor, user_id }: Props) => {
  // const [commands, setCommands] = React.useState<CommandsTable[]>(initialCommands);
  const [optimisticCommands, dispatch] = useOptimistic(initialCommands, reducer);

  // Function to add a command
  const addCommand = async (command: CommandSchemaType) => {
    const new_command: CommandsTable = {
      ...command,
      channel_id: channel_id,
      user_id: user_id,
      updated_by: editor,
      updated_at: new Date(),
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
  const updateCommand = async (command: CommandsTable) => {
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
  const deleteCommand = async (commands: CommandsTable[]) => {
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
