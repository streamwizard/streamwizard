'use client'
import { BannedChatterContext, BannedChatterContextType } from '@/providers/banned-chatter-provider';
import { useContext } from 'react';

function useBannedChatters(): BannedChatterContextType {
  const context = useContext(BannedChatterContext);
  if (context === undefined) {
    throw new Error("useBannedChatters must be used within a UseBannedChatterProvider");
  }
  return context;
}

export default useBannedChatters;
