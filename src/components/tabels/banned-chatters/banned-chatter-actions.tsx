"use client";
import { Button } from "@/components/ui/button";
import useBannedChatters from "@/hooks/useBannedChatter";
import { SpotifyBannedChatterTable } from "@/types/database";
import React from "react";


interface props {
  chatter: SpotifyBannedChatterTable
}

export default function BannedChatterActions({ chatter }: props) {
  const { unbanChatter } = useBannedChatters();

  


  return <Button variant="outline" onClick={() => unbanChatter([chatter])}>Unban</Button>;
}
