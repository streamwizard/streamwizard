import { TwitchContext } from "@/providers/api-providers/twitch-provider";
import { useContext } from "react";

export const useTwitchProvider = () => {
  const context = useContext(TwitchContext);
  if (!context) {
    throw new Error("useEditor Hook must be used within the Twitch Provider");
  }
  return context;
};