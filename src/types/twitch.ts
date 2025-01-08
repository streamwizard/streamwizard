// General Pagination
export type Pagination = {
  cursor?: string; // Cursor value for pagination
};

// Common Transport Details for Subscriptions
export type TransportMethod = "webhook" | "websocket" | "conduit";

export type TransportDetails = {
  method: TransportMethod;
  callback?: string; // Only for "webhook"
  session_id?: string; // Only for "websocket"
  connected_at?: string; // Only for "websocket"
  conduit_id?: string; // Only for "conduit"
};

// Event Subscriptions
export type SubscriptionStatus =
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

export type EventSubSubscriptionType =
  | "automod.message.hold"
  | "automod.message.update"
  | "channel.update"
  | "channel.follow"
  | "channel.subscribe"
  | "channel.subscription.end"
  | "stream.online"
  | "stream.offline"
  | "user.authorization.grant"
  | "user.authorization.revoke"
  | "user.update";

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  type: EventSubSubscriptionType;
  version: string;
  condition: Record<string, any>; // Dynamic JSON based on type
  created_at: string; // RFC3339 format
  transport: TransportDetails;
  cost: number;
};

export type GetEventSubSubscriptionsResponse = {
  data: Subscription[];
  total: number;
  total_cost: number;
  max_total_cost: number;
  pagination: Pagination;
};

// Twitch Channel Data
export type ChannelSearchResults = {
  data: ChannelSearchResult[];
};

export type ChannelSearchResult = {
  broadcaster_language: string;
  broadcaster_login: string;
  display_name: string;
  game_id: string;
  game_name: string;
  id: string;
  is_live: boolean;
  tags: string[]; // Updated as `tag_ids` is deprecated
  thumbnail_url: string;
  title: string;
};

// Channel Followers
export type ChannelFollowers = {
  followed_at: string;
  user_id: string;
  user_login: string;
  user_name: string;
};

export type GetChannelFollowersResponse = {
  total: number;
  data: ChannelFollowers[];
  pagination: Pagination;
};

// Twitch User
export type GetUserResponse = {
  data: TwitchUser[];
};

export type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  type: "admin" | "global_mod" | "staff" | "";
  broadcaster_type: "affiliate" | "partner" | "";
  description: string;
  profile_image_url: string;
  offline_image_url: string;
  view_count: number | null;
  email?: string;
  created_at: string; // In RFC3339 format
};

// Twitch Channel Points
export type TwitchChannelPointsResponse = {
  data: TwitchChannelPointsReward[];
};

export type TwitchChannelPointsReward = {
  id: string;
  title: string;
  broadcaster_id: string;
  broadcaster_login: string;
  broadcaster_name: string;
  prompt?: string;
  cost: number;
  image?: TwitchChannelPointsImage;
  default_image?: TwitchChannelPointsImage;
  background_color: string;
  is_enabled: boolean;
  is_user_input_required: boolean;
  max_per_stream_setting: TwitchChannelPointsMaxSetting;
  max_per_user_per_stream_setting: MaxPerUserPerStreamSetting;
  global_cooldown_setting: TwitchChannelPointsCooldownSetting;
  is_paused: boolean;
  is_in_stock: boolean;
  should_redemptions_skip_request_queue: boolean;
  redemptions_redeemed_current_stream?: number;
  cooldown_expires_at?: string;
};

export type TwitchChannelPointsImage = {
  url_1x: string;
  url_2x: string;
  url_4x: string;
};

export type TwitchChannelPointsMaxSetting = {
  is_enabled: boolean;
  max_per_stream?: number;
};

export type MaxPerUserPerStreamSetting = {
  is_enabled: boolean;
  max_per_user_per_stream?: number;
};

export type TwitchChannelPointsCooldownSetting = {
  is_enabled: boolean;
  global_cooldown_seconds?: number;
};

// Twitch Clips
export type TwitchClipResponse = {
  data: TwitchClip[];
  pagination: Pagination;
};

export type TwitchClip = {
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
};

// Twitch Categories
export type TwitchCategory = {
  id: string;
  name: string;
  box_art_url: string;
};

export type SearchCategories = {
  data: TwitchCategory[];
};

// Event Subscriptions Request
export type CreateEventSubSubscriptionRequest = {
  type: EventSubSubscriptionType; // The type of subscription to create.
  version: string; // The version of the subscription type.
  condition: Record<string, any>; // Subscription-specific parameter values.
  transport: {
    method: TransportMethod; // Transport method.
    callback?: string; // HTTPS callback URL (required for webhook method).
    secret?: string; // Secret for verifying webhook signatures.
    session_id?: string; // WebSocket session ID (required for websocket method).
    conduit_id?: string; // Conduit ID (required for conduit method).
  };
};

export type GetGamesResponse = {
  data: {
    id: string;
    name: string;
    box_art_url: string;
    igdb_id: string;
  }[];
};
