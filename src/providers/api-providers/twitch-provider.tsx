"use client";
import { TwitchChannelPointsResponse, TwitchChannelPointsReward } from "@/types/API/twitch";
import { createContext, useState } from "react";

export interface TwitchContextType {
  channelPoints: TwitchChannelPointsReward[] | null;
}

// create context for twitch provider
const TwitchContext = createContext<TwitchContextType | null>(null);

// create twitch provider

interface TwitchProviderProps {
  children: React.ReactNode;
  channelpoints?: TwitchChannelPointsReward[] | null;
}
const TwitchProvider = ({ children, channelpoints = null }: TwitchProviderProps) => {
  const [channelPoints, setChannelPoints] = useState<TwitchChannelPointsReward[] | null>(channelpoints);

  const values: TwitchContextType = {
    channelPoints,
  };

  return <TwitchContext.Provider value={values}>{children}</TwitchContext.Provider>;
};

export { TwitchContext, TwitchProvider };

