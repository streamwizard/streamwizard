/**
 * Shapes handed to widgets. Deliberately flatter than Helix's own: a widget
 * renders a badge from `badges[set_id][version]`, so the maps are keyed for
 * that lookup rather than shipped as arrays the widget has to index itself.
 */

export interface BadgeImage {
  url_1x: string;
  url_2x: string;
  url_4x: string;
  title: string;
  description: string;
}

/** set_id → version → image. Channel badges override global ones. */
export type BadgeMap = Record<string, Record<string, BadgeImage>>;

export interface CheermoteTier {
  min_bits: number;
  id: string;
  color: string;
  /** theme → format → scale → url, straight from Helix. */
  images: Record<string, Record<string, Record<string, string>>>;
}

/** Lowercased prefix → tiers, sorted by min_bits descending. */
export type CheermoteMap = Record<string, { prefix: string; tiers: CheermoteTier[] }>;

/** The only user fields a widget gets. Everything else Helix returns is dropped. */
export interface PublicUser {
  id: string;
  login: string;
  display_name: string;
  profile_image_url: string;
}

export interface PublicGame {
  id: string;
  name: string;
  /** Helix template with {width}x{height} placeholders still in it. */
  box_art_url: string;
}

export interface PublicStream {
  is_live: boolean;
  viewer_count: number;
  game_id: string | null;
  game_name: string | null;
  title: string | null;
  started_at: string | null;
  thumbnail_url: string | null;
}

export type ThirdPartyProvider = "7tv" | "bttv" | "ffz";

export interface ThirdPartyEmote {
  id: string;
  name: string;
  provider: ThirdPartyProvider;
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

/** Emote code → emote. Codes are case-sensitive, as chat matches them. */
export type ThirdPartyEmoteMap = Record<string, ThirdPartyEmote>;

/** One of the channel's own Twitch emotes, in the same url shape as the third-party ones. */
export interface ChannelEmote {
  id: string;
  name: string;
  url_1x: string;
  url_2x: string;
  url_4x: string;
}

/** Emote code → emote. */
export type ChannelEmoteMap = Record<string, ChannelEmote>;

export type PublicGoalType =
  | "follow"
  | "subscription"
  | "subscription_count"
  | "new_subscription"
  | "new_subscription_count"
  | "new_bit"
  | "new_cheerer";

/** An active Creator Goal, in the same shape as the channel.goal.* events. */
export interface PublicGoal {
  id: string;
  type: PublicGoalType;
  description: string;
  current_amount: number;
  target_amount: number;
  started_at: string;
}

export interface LiveGoals {
  goals: PublicGoal[];
  /** The stored token lacks channel:read:goals; the user has to reconnect. */
  missing_scope: boolean;
}

export type PublicPollStatus = "active" | "completed" | "terminated" | "archived";

export interface PublicPollChoice {
  id: string;
  title: string;
  votes: number;
  channel_points_votes: number;
  bits_votes: number;
}

/** A poll in the same shape as the channel.poll.* events, running or just ended. */
export interface PublicPoll {
  id: string;
  title: string;
  choices: PublicPollChoice[];
  status: PublicPollStatus;
  started_at: string;
  /** When a running poll closes. */
  ends_at: string;
  /** Null while it runs. */
  ended_at: string | null;
  bits_voting: { is_enabled: boolean; amount_per_vote: number };
  channel_points_voting: { is_enabled: boolean; amount_per_vote: number };
}

export interface LivePoll {
  /** The running poll, or one that ended in the last minute; otherwise null. */
  poll: PublicPoll | null;
  /** The stored token lacks channel:read:polls; the user has to reconnect. */
  missing_scope: boolean;
}

/** The channel's ad schedule, with Twitch's mixed formats settled. */
export interface PublicAdSchedule {
  /** ISO time of the next scheduled ad; null when none is scheduled or the channel is offline. */
  next_ad_at: string | null;
  last_ad_at: string | null;
  /** Seconds the next ad break runs. */
  duration: number;
  /** Seconds of pre-roll-free time left. */
  preroll_free_time: number;
  snooze_count: number;
  snooze_refresh_at: string | null;
}

export interface LiveAdSchedule {
  schedule: PublicAdSchedule | null;
  /** The stored token lacks channel:read:ads; the user has to reconnect. */
  missing_scope: boolean;
}
