"use client";
import { Button } from "@/components/ui/button";
import useBannedChatters from "@/hooks/useBannedChatter";
import { BannedChatter } from "@/types/database/banned-chatter";
import React from "react";


interface props {
  chatter: BannedChatter
}

export default function BannedChatterActions({ chatter }: props) {
  const { unbanChatter } = useBannedChatters();

  


  return <Button variant="outline" onClick={() => unbanChatter([chatter])}>Unban</Button>;
}
