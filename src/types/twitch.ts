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
  followed_at: string;
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

export type GetUserResponse = {
  data: TwitchUser[];
};
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

export interface TwitchChannelPointsResponse {
  data: TwitchChannelPointsReward[];
}

interface TwitchChannelPointsReward {
  id: string;
  title: string;
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  prompt?: string; // Optional field if user input is required
  cost: number;
  image?: TwitchChannelPointsImage; // Optional field if custom images uploaded
  default_image?: TwitchChannelPointsImage; // Optional field for default images
  background_color: string;
  is_enabled: boolean;
  is_user_input_required: boolean;
  max_per_stream_setting: TwitchChannelPointsMaxSetting;
  max_per_user_per_stream_setting: max_per_user_per_stream_setting;
  global_cooldown_setting: TwitchChannelPointsCooldownSetting;
  is_paused: boolean;
  is_in_stock: boolean;
  should_redemptions_skip_request_queue: boolean;
  redemptions_redeemed_current_stream?: number; // Optional field if live stream active
  cooldown_expires_at?: string; // Optional field if reward is in cooldown
}

interface TwitchChannelPointsImage {
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

interface TwitchChannelPointsMaxSetting {
  is_enabled: boolean;
  max_per_stream?: number; // Optional field if limit applies
}
interface max_per_user_per_stream_setting {
  is_enabled: boolean;
  max_per_user_per_stream?: number; // Optional field if limit applies
}

interface TwitchChannelPointsCooldownSetting {
  is_enabled: boolean;
  global_cooldown_seconds?: number; // Optional field if cooldown active
}

export interface getConduitsResponse {
  data: {
    id: string;
    shard_count: number;
  }[];
}

export interface GetEventSubSubscriptionsResponse {
  data: Subscription[];
  total: number;
  total_cost: number;
  max_total_cost: number;
  pagination: Pagination;
}

interface Subscription {
  id: string;
  status: SubscriptionStatus;
  type: string;
  version: string;
  condition: Record<string, any>; // Assuming JSON object, use Record<string, any> for a general object type
  created_at: string; // RFC3339 format
  transport: Transport;
  cost: number;
}

type SubscriptionStatus =
  | "enabled"
  | "webhook_callback_verification_pending"
  | "webhook_callback_verification_failed"
  | "notification_failures_exceeded"
  | "authorization_revoked"
  | "moderator_removed"
  | "user_removed"
  | "version_removed"
  | "beta_maintenance"
  | "websocket_disconnected"
  | "websocket_failed_ping_pong"
  | "websocket_received_inbound_traffic"
  | "websocket_connection_unused"
  | "websocket_internal_error"
  | "websocket_network_timeout"
  | "websocket_network_error";

interface Transport {
  method: "webhook" | "websocket" | "conduit";
  callback?: string; // Included only if method is set to 'webhook'
  session_id?: string; // Included only if method is set to 'websocket'
  connected_at?: string; // Included only if method is set to 'websocket'
  disconnected_at?: string; // Included only if method is set to 'websocket'
  conduit_id?: string; // Included only if method is set to 'conduit'
}

interface Pagination {
  cursor?: string; // The cursor value for pagination
}

export interface TwitchClipResponse {
  data: TwitchClip[];
  pagination: Pagination;
}

export interface TwitchClip {
  id: string;
  url: string;
  embed_url: string;
  broadcaster_id: string;
  broadcaster_name: string;
  creator_id: string;
  creator_name: string;
  video_id: string;
  game_id: string;
  language: string;
  title: string;
  view_count: number;
  created_at: string;
  thumbnail_url: string;
  duration: number;
  vod_offset: number | null;
  is_featured: boolean;
}

export interface TwitchCategory {
  id: string;
  name: string;
  box_art_url: string;
}

export interface SearchCategories {
  data: TwitchCategory[];
}
