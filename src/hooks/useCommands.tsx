'use client'
import { useContext } from 'react';
import { CommandContext } from '@/providers/commands-provider'; 
import type {CommandContextType} from "@/providers/commands-provider";

function useCommands(): CommandContextType {
  const context = useContext(CommandContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export default useCommands;
