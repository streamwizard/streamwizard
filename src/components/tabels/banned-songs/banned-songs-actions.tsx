"use client";
import { Button } from "@/components/ui/button";
import useBannedChatters from "@/hooks/useBannedChatter";
import useBannedSongs from "@/hooks/useBannedSongs";
import { BannedChatter } from "@/types/database/banned-chatter";
import { BannedSongs } from "@/types/database/banned-songs";
import React from "react";


interface props {
  song: BannedSongs
}

export default function BannedSongsActions({ song }: props) {
  const { unbanSong } = useBannedSongs();

  


  return <Button variant="outline" onClick={() => unbanSong([song])}>Unban</Button>;
}
