import { getChannelPoints } from "@/actions/twitch/twitch-api";
import { ChannelPointsProvider } from "@/providers/channelpoints-provider";
import React from "react";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const channelpoints = await getChannelPoints();

  return <ChannelPointsProvider initialChannelPoints={channelpoints}>{children}</ChannelPointsProvider>;
}
