"use client";
import { getSpotifySettings } from "@/actions/supabase/table-spotify-settings";
import TwitchSearchBar from "@/components/search-bars/twitch-search-bar";
import { BannedChatterColumns } from "@/components/tabels/banned-chatters/banned-chatter-columns";
import { BannedChatterTable } from "@/components/tabels/banned-chatters/banned-chatter-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import React from "react";

export default function page() {
  return (
    <div className="hidden h-full flex-1 flex-col  md:flex">
      <div className="space-y-2 ">
        <TwitchSearchBar />
        <div className="flex items-center space-x-2">
          <BannedChatterTable columns={BannedChatterColumns} />
        </div>
      </div>
    </div>
  );
}
