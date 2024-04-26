export interface ChannelSearchResults {
  data: ChannelSearchResult[];
}

export interface ChannelSearchResult {
  broadcaster_language: string; // The ISO 639-1 two-letter language code of the language used by the broadcaster.
  broadcaster_login: string; // The broadcaster’s login name.
  display_name: string; // The broadcaster’s display name.
  game_id: string; // The ID of the game that the broadcaster is playing or last played.
  game_name: string; // The name of the game that the broadcaster is playing or last played.
  id: string; // An ID that uniquely identifies the channel (this is the broadcaster’s ID).
  is_live: boolean; // A Boolean value that determines whether the broadcaster is streaming live. Is true if the broadcaster is streaming live; otherwise, false.
  tag_ids: string[]; // IMPORTANT: As of February 28, 2023, this field is deprecated and returns only an empty array. If you use this field, please update your code to use the tags field.
  tags: string[]; // The tags applied to the channel.
  thumbnail_url: string; // A URL to a thumbnail of the broadcaster’s profile image.
  title: string; // The stream’s title. Is an empty string if the broadcaster didn’t set it.
  started_at: string; // The UTC date and time (in RFC3339 format) of when the broadcaster started streaming. The string is empty if the broadcaster is not streaming live.
}

export interface RefreshTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

export interface ChannelFollowers {
  followed_at: date;
  user_id: string;
  user_login: string;
  user_name: string;
}
export interface getChannelFollowersResponse {
  total: number;
  data: ChannelFollowers[];
  pagination: {
    cursor: string;
  };
}
export interface TwitchUser {
  id: string;
  login: string;
  display_name: string;
  type: "admin" | "global_mod" | "staff" | "";
  broadcaster_type: "affiliate" | "partner" | "";
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number | null; // Considering deprecation, it could be `null` or not present.
  email?: string; // Optional because it depends on the user access token's scope.
  created_at: string; // In RFC3339 format.
}
export interface getTwitchUserResponse {
  data: User[];
}
