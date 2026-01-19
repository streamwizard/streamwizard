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
  // Automod Topics
  | "automod.message.hold"
  | "automod.message.update"
  | "automod.settings.update"
  | "automod.terms.update"

  // Channel Topics
  | "channel.update"
  | "channel.follow"
  | "channel.ad_break.begin"
  | "channel.chat.clear"
  | "channel.chat.clear_user_messages"
  | "channel.chat.message"
  | "channel.chat.message_delete"
  | "channel.chat.notification"
  | "channel.chat_settings.update"
  | "channel.chat.user_message_hold"
  | "channel.chat.user_message_update"
  | "channel.shared_chat.begin"
  | "channel.shared_chat.update"
  | "channel.shared_chat.end"
  | "channel.subscribe"
  | "channel.subscription.end"
  | "channel.subscription.gift"
  | "channel.subscription.message"
  | "channel.cheer"
  | "channel.raid"
  | "channel.ban"
  | "channel.unban"
  | "channel.unban_request.create"
  | "channel.unban_request.resolve"
  | "channel.moderate"
  | "channel.moderator.add"
  | "channel.moderator.remove"

  // Guest Star Topics (BETA)
  | "channel.guest_star_session.begin"
  | "channel.guest_star_session.end"
  | "channel.guest_star_guest.update"
  | "channel.guest_star_settings.update"

  // Channel Points Topics
  | "channel.channel_points_automatic_reward_redemption.add"
  | "channel.channel_points_custom_reward.add"
  | "channel.channel_points_custom_reward.update"
  | "channel.channel_points_custom_reward.remove"
  | "channel.channel_points_custom_reward_redemption.add"
  | "channel.channel_points_custom_reward_redemption.update"

  // Poll/Prediction Topics
  | "channel.poll.begin"
  | "channel.poll.progress"
  | "channel.poll.end"
  | "channel.prediction.begin"
  | "channel.prediction.progress"
  | "channel.prediction.lock"
  | "channel.prediction.end"

  // Moderation & Safety Topics
  | "channel.suspicious_user.message"
  | "channel.suspicious_user.update"
  | "channel.vip.add"
  | "channel.vip.remove"
  | "channel.warning.acknowledge"
  | "channel.warning.send"

  // Charity Topics
  | "channel.charity_campaign.donate"
  | "channel.charity_campaign.start"
  | "channel.charity_campaign.progress"
  | "channel.charity_campaign.stop"

  // Infrastructure Topics
  | "conduit.shard.disabled"

  // Drops & Extensions
  | "drop.entitlement.grant"
  | "extension.bits_transaction.create"

  // Authorization & User Topics
  | "user.authorization.grant"
  | "user.authorization.revoke"
  | "user.update"
  | "user.whisper.message"

  // Stream Status Topics
  | "stream.online"
  | "stream.offline"

  // Hype Train Topics
  | "channel.hype_train.begin"
  | "channel.hype_train.progress"
  | "channel.hype_train.end"

  // Shield Mode Topics
  | "channel.shield_mode.begin"
  | "channel.shield_mode.end"

  // Shoutout Topics
  | "channel.shoutout.create"
  | "channel.shoutout.receive";

export type Subscription = {
  id: string;
  status: SubscriptionStatus;
  type: EventSubSubscriptionType;
  version: string;
  condition: Record<string, unknown>; // Dynamic JSON based on type
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
  condition: Record<string, unknown>; // Subscription-specific parameter values.
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

// Twitch Videos (VODs)
export type TwitchVideoType = "upload" | "archive" | "highlight";

export type TwitchVideoMutedSegment = {
  duration: number;
  offset: number;
};

export type TwitchVideo = {
  id: string;
  stream_id: string | null;
  user_id: string;
  user_login: string;
  user_name: string;
  title: string;
  description: string;
  created_at: string;
  published_at: string;
  url: string;
  thumbnail_url: string;
  viewable: "public" | "private";
  view_count: number;
  language: string;
  type: TwitchVideoType;
  duration: string;
  muted_segments: TwitchVideoMutedSegment[] | null;
};

export type GetVideosResponse = {
  data: TwitchVideo[];
  pagination: Pagination;
};

export type DeleteVideosResponse = {
  data: string[];
};

export type CreateClipResponse = {
  data: {
    id: string;
    edit_url: string;
  }[];
};
