"use client";
import { Button } from "@/components/ui/button";
import useBannedChatters from "@/hooks/useBannedChatter";
import useBannedSongs from "@/hooks/useBannedSongs";
import { SpotifyBannedSongsTable } from "@/types/database";
import React from "react";


interface props {
  song: SpotifyBannedSongsTable
}

export default function BannedSongsActions({ song }: props) {
  const { unbanSong } = useBannedSongs();

  


  return <Button variant="outline" onClick={() => unbanSong([song])}>Unban</Button>;
}
