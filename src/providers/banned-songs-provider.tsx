"use client";
import { addBannedSong, deleteBannedSong } from "@/actions/supabase/table-banned-songs";
import { SpotifyBannedSongsTable, InsertSpotifyBannedSongsTable } from "@/types/database";

import React, { ReactNode, createContext, startTransition, useOptimistic } from "react";
import { toast } from "sonner";

// Define the type for the context
export interface BannedSongsContextType {
  bannedSongs: SpotifyBannedSongsTable[];
  unbanSong: (chatter: SpotifyBannedSongsTable[]) => void;
  banSong: (song: { song_name: string; song_id: string; artists: string  }) => void;
}

// Create the context with TypeScript type
export const BannedSongsContext = createContext<BannedSongsContextType | undefined>(undefined);

interface Props {
  children: ReactNode;
  initialBannedSongs: SpotifyBannedSongsTable[];
  user_id: string;
  settings_id: string;
  editor: string;
}

function reducer(state: SpotifyBannedSongsTable[], action: { type: string; payload: SpotifyBannedSongsTable }) {
  switch (action.type) {
    case "ADD_SONG":
      return [...state, action.payload];
    case "DELETE_SONG":
      return state.filter((c) => c.id !== action.payload.id);
    default:
      return state;
  }
}

export const BannedSongsProvider = ({ children, initialBannedSongs, editor, user_id, settings_id }: Props) => {
  const [optimisticBannedChatters, dispatch] = useOptimistic(initialBannedSongs, reducer);

  // Function to add a command
  const banSong = async (song: { song_name: string; song_id: string, artists: string }) => {
    const banned_chatter: InsertSpotifyBannedSongsTable = {
      ...song,
      broadcaster_name: editor,
      created_at: new Date().toDateString(),
      settings_id,
      user_id,
      artists: song.artists,
      broadcaster_id: user_id,
    };

    // startTransition(() => {
    //   dispatch({ type: "ADD_SONG", payload: banned_chatter });
    // });

    try {
      await addBannedSong(banned_chatter);
    } catch (error: any) {
      toast.error(error.message);
      return;
    }

    toast.success(`${song.song_name} has been banned from being requested`);
  };

  // Function to delete a command
  const unBanSong = async (song: SpotifyBannedSongsTable[]) => {
    startTransition(() => {
      song.forEach((chatter) => {
        dispatch({ type: "DELETE_SONG", payload: chatter });
      });
    });

    const song_ids = song.map((c) => c.id).filter((id) => id !== undefined) as string[];

    song_ids.forEach(async (id) => {
      try {
        await deleteBannedSong(id);
        toast.success("Song has been unbanned");
      } catch (error: any) {
        toast.error(error.message);
      }
    });
  };

  // Value that will be passed to context consumers
  const value: BannedSongsContextType = { bannedSongs: optimisticBannedChatters, banSong, unbanSong: unBanSong };

  return <BannedSongsContext.Provider value={value}>{children}</BannedSongsContext.Provider>;
};
