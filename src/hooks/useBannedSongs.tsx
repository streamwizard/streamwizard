'use client'
import { BannedSongsContextType, BannedSongsContext } from '@/providers/banned-songs-provider';
import { useContext } from 'react';

function useBannedSongs(): BannedSongsContextType {
  const context = useContext(BannedSongsContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

export default useBannedSongs;
