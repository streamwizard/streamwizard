import { ChannelSearchResult } from "@/types/twitch";

// Common props for all forms
export interface FormProps {
  selectedStreamer: ChannelSearchResult | null;
  action: string;
  metadata: Record<string, any>;
  onClose: () => void;
}

// Default Twitch user for testing
export const DEFAULT_TWITCH_USER: ChannelSearchResult = {
  id: "12826",
  broadcaster_login: "twitch",
  display_name: "Twitch",
  broadcaster_language: "en",
  game_id: "",
  game_name: "",
  is_live: false,
  tags: [],
  thumbnail_url: "",
  title: "",
};

