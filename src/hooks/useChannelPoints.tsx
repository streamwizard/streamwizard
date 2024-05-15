'use client'
import { BannedSongsContextType, BannedSongsContext } from '@/providers/banned-songs-provider';
import { ChannelPointContext, ChannelPointContextType } from '@/providers/channelpoints-provider';
import { useContext } from 'react';

function useChannelPoints(): ChannelPointContextType {
  const context = useContext(ChannelPointContext);
  if (context === undefined) {
    throw new Error("useChannelPointscontext must be used within a channelPointProvider");
  }
  return context;
}

export default useChannelPoints;
