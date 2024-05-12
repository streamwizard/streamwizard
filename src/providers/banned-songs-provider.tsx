"use client";
import { addBannedChatter, removeBannedChatter } from "@/actions/supabase/table-banned_chatters";
import { BannedSongs } from "@/types/database/banned-songs";
import React, { ReactNode, createContext, startTransition, useOptimistic } from "react";
import { toast } from "sonner";

// Define the type for the context
export interface BannedSongsContextType {
  bannedSongs: BannedSongs[];
  unbanSong: (chatter: BannedSongs[]) => void;
  banSong: (song: { song_name: string, song_id: string, chatter_id: string; chatter_name: string }) => void;
}

// Create the context with TypeScript type
export const BannedSongsContext = createContext<BannedSongsContextType | undefined>(undefined);

interface Props {
  children: ReactNode;
  initialBannedSongs: BannedSongs[];
  user_id: string;
  settings_id: string;
  broadcaster_id: number;
  editor: string;
}

function reducer(state: BannedSongs[], action: { type: string; payload: BannedSongs }) {
  switch (action.type) {
    case "ADD_SONG":
      return [...state, action.payload];    
    case "DELETE_SONG":
      return state.filter((c) => c.id !== action.payload.id);
    default:
      return state;
  }
}

export const BannedSongsProvider = ({ children, initialBannedSongs, broadcaster_id, editor, user_id, settings_id }: Props) => {
  const [optimisticBannedChatters, dispatch] = useOptimistic(initialBannedSongs, reducer);

  // Function to add a command
  const banSong = async (song: { song_name: string, song_id: string, chatter_id: string; chatter_name: string }) => {
    const banned_chatter: BannedSongs = {
      ...song,
      broadcaster_id: broadcaster_id.toString(),
      broadcaster_name: editor,    
      created_at: new Date(),
      settings_id,
      user_id,
    };


    startTransition(() => {
      dispatch({ type: "ADD_SONG", payload: banned_chatter });
    });

    // const {error} = await addBannedChatter(banned_chatter, "/dashboard/banned-chatters")

    // if(error) {
    //   toast.error(error);
    //   return;
    // }

    toast.success(`${song.song_name} has been banned from using song requests`);

   
  };

  // Function to delete a command
  const unBanSong = async (song: BannedSongs[]) => {
    startTransition(() => {
      song.forEach((chatter) => {
        dispatch({ type: "DELETE_SONG", payload: chatter });
      });
    });

    const song_ids = song.map((c) => c.id).filter((id) => id !== undefined) as string[];

    song_ids.forEach(async (id) => {
      const { affectedRows, error } = await removeBannedChatter(id, "/dashboard/commands");

      if (error) {
        toast.error(error);
        return;
      }


      if (affectedRows) {
        toast.success(`Successfully deleted ${affectedRows} commands`);
      }


    });
  };

  // Value that will be passed to context consumers
  const value: BannedSongsContextType = { bannedSongs: optimisticBannedChatters, banSong, unbanSong: unBanSong };

  return <BannedSongsContext.Provider value={value}>{children}</BannedSongsContext.Provider>;
};
