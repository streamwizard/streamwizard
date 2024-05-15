import { get_twitch_integration } from "@/actions/supabase/table-twitch_integration";
import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { BannedSongsProvider } from "@/providers/banned-songs-provider";
import { ChannelPointsProvider } from "@/providers/channelpoints-provider";
import { createClient } from "@/utils/supabase/server";
import React from "react";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const channelpoints = await getChannelPoints();
  const twitch_integration = await get_twitch_integration();
  if (!channelpoints) {
    return null;
  }

  return <ChannelPointsProvider initialChannelPoints={channelpoints}>{children}</ChannelPointsProvider>;
}
