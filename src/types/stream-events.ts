import { IconType } from "./icons";
import {
  Tv,
  UserPlus,
  MessageSquare,
  Zap,
  Swords,
  Ban,
  Gift,
  Bell,
  Settings,
  Users,
  Megaphone,
  AlertCircle,
  CheckCircle2,
  HandMetal,
  LucideIcon,
} from "lucide-react";
import { Database } from "./supabase";

/**
 * Stream Event Types from Supabase
 */

/**
 * Event types that can occur during a stream
 */
export type StreamEventType =
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

  // Channel Points Topics
  | "channel.channel_points_automatic_reward_redemption.add"
  | "channel.channel_points_custom_reward.add"
  | "channel.channel_points_custom_reward.update"
  | "channel.channel_points_custom_reward.remove"
  | "channel.channel_points_custom_reward_redemption.add"
  | "channel.channel_points_custom_reward_redemption.update"

  // Shoutout Topics
  | "channel.shoutout.create"
  | "channel.shoutout.receive";

/**
 * A stream event stored in Supabase (matches stream_events table schema)
 */
export type StreamEvent = Database["public"]["Tables"]["stream_events"]["Row"];

/**
 * Result of fetching stream events
 */
export interface GetStreamEventsResult {
  success: boolean;
  events?: StreamEvent[];
  error?: string;
}

/**
 * Get display info for an event type
 */
export function getEventTypeInfo(type: StreamEventType): {
  label: string;
  color: string;
  icon: LucideIcon;
} {
  const info: Record<StreamEventType, { label: string; color: string; icon: IconType }> = {
    "channel.ad_break.begin": { label: "Ad Break", color: "bg-amber-500", icon: Tv },
    "channel.follow": { label: "Follow", color: "bg-blue-500", icon: UserPlus },
    "channel.subscription.message": {
      label: "Subscription",
      color: "bg-purple-500",
      icon: MessageSquare,
    },
    "channel.subscription.gift": { label: "Gifted Sub", color: "bg-pink-500", icon: Gift },
    "channel.cheer": { label: "Cheer", color: "bg-emerald-500", icon: Zap },
    "channel.raid": { label: "Raid", color: "bg-indigo-500", icon: Swords },
    "channel.ban": { label: "Ban", color: "bg-red-600", icon: Ban },
    "channel.unban": { label: "Unban", color: "bg-green-600", icon: CheckCircle2 },
    "channel.chat.notification": { label: "Chat Notification", color: "bg-slate-500", icon: Bell },
    "channel.chat_settings.update": {
      label: "Chat Settings",
      color: "bg-slate-600",
      icon: Settings,
    },
    "channel.moderator.add": { label: "Mod Added", color: "bg-orange-500", icon: Users },
    "channel.shoutout.create": { label: "Shoutout", color: "bg-fuchsia-500", icon: Megaphone },
    "channel.channel_points_custom_reward_redemption.add": {
      label: "Points Redemption",
      color: "bg-cyan-500",
      icon: HandMetal,
    },

    // Add more mappings as needed...
    "channel.update": { label: "Channel Update", color: "bg-slate-400", icon: Settings },
    "channel.chat.clear": { label: "Chat Cleared", color: "bg-slate-700", icon: Ban },
    "channel.chat.clear_user_messages": { label: "User Cleared", color: "bg-slate-700", icon: Ban },
    "channel.chat.message": { label: "Message", color: "bg-slate-400", icon: MessageSquare },
    "channel.chat.message_delete": { label: "Message Deleted", color: "bg-slate-700", icon: Ban },
    "channel.chat.user_message_hold": {
      label: "Message Held",
      color: "bg-slate-700",
      icon: AlertCircle,
    },
    "channel.chat.user_message_update": {
      label: "Message Updated",
      color: "bg-slate-400",
      icon: MessageSquare,
    },
    "channel.shared_chat.begin": { label: "Shared Chat", color: "bg-slate-500", icon: Users },
    "channel.shared_chat.update": {
      label: "Shared Chat Update",
      color: "bg-slate-500",
      icon: Users,
    },
    "channel.shared_chat.end": { label: "Shared Chat End", color: "bg-slate-500", icon: Users },
    "channel.subscribe": { label: "Subscription", color: "bg-purple-500", icon: MessageSquare },
    "channel.subscription.end": {
      label: "Subscription End",
      color: "bg-slate-500",
      icon: MessageSquare,
    },
    "channel.unban_request.create": {
      label: "Unban Request",
      color: "bg-orange-400",
      icon: AlertCircle,
    },
    "channel.unban_request.resolve": {
      label: "Unban Resolved",
      color: "bg-green-500",
      icon: CheckCircle2,
    },
    "channel.moderate": { label: "Interaction", color: "bg-slate-500", icon: Settings },
    "channel.moderator.remove": { label: "Mod Removed", color: "bg-slate-500", icon: Users },
    "channel.channel_points_automatic_reward_redemption.add": {
      label: "Points Redemption",
      color: "bg-cyan-500",
      icon: HandMetal,
    },
    "channel.channel_points_custom_reward.add": {
      label: "Reward Added",
      color: "bg-cyan-600",
      icon: HandMetal,
    },
    "channel.channel_points_custom_reward.update": {
      label: "Reward Updated",
      color: "bg-cyan-600",
      icon: HandMetal,
    },
    "channel.channel_points_custom_reward.remove": {
      label: "Reward Removed",
      color: "bg-cyan-600",
      icon: HandMetal,
    },
    "channel.channel_points_custom_reward_redemption.update": {
      label: "Redemption Updated",
      color: "bg-cyan-600",
      icon: HandMetal,
    },
    "channel.shoutout.receive": {
      label: "Shoutout Received",
      color: "bg-fuchsia-600",
      icon: Megaphone,
    },
  };
  return info[type] || { label: type, color: "bg-gray-500", icon: AlertCircle };
}

/**
 * Extract a human-readable subtitle from the event's event_data based on event type.
 * Returns null if no meaningful subtitle can be generated.
 */
export function getEventSubtitle(event: StreamEvent): string | null {
  const data = event.event_data as Record<string, unknown> | null;
  if (!data) return null;

  switch (event.event_type) {
    // Channel Points Redemptions
    case "channel.channel_points_custom_reward_redemption.add":
    case "channel.channel_points_custom_reward_redemption.update":
    case "channel.channel_points_automatic_reward_redemption.add": {
      const reward = data.reward as { title?: string; cost?: number } | undefined;
      if (reward?.title) {
        return `${reward.title}${reward.cost ? ` (${reward.cost} pts)` : ""}`;
      }
      const userInput = data.user_input as string | undefined;
      if (userInput) return userInput;
      break;
    }

    // Cheers
    case "channel.cheer": {
      const bits = data.bits as number | undefined;
      return bits ? `${bits} bits` : null;
    }

    // Raids
    case "channel.raid": {
      const viewers = data.viewers as number | undefined;
      const fromName = data.from_broadcaster_user_name as string | undefined;
      if (viewers && fromName) return `${fromName} with ${viewers} viewers`;
      if (viewers) return `${viewers} viewers`;
      return null;
    }

    // Subscriptions
    case "channel.subscribe":
    case "channel.subscription.message": {
      const tier = data.tier as string | undefined;
      const tierLabel = tier === "1000" ? "Tier 1" : tier === "2000" ? "Tier 2" : tier === "3000" ? "Tier 3" : tier;
      return tierLabel || null;
    }

    case "channel.subscription.gift": {
      const total = data.total as number | undefined;
      const tier = data.tier as string | undefined;
      const tierLabel = tier === "1000" ? "Tier 1" : tier === "2000" ? "Tier 2" : tier === "3000" ? "Tier 3" : "";
      if (total) return `${total} gift${total > 1 ? "s" : ""}${tierLabel ? ` (${tierLabel})` : ""}`;
      return null;
    }

    // Bans
    case "channel.ban": {
      const reason = data.reason as string | undefined;
      const isPermanent = data.is_permanent as boolean | undefined;
      if (isPermanent === false) {
        const ends = data.ends_at as string | undefined;
        if (ends) return `Timeout until ${new Date(ends).toLocaleTimeString()}`;
      }
      return reason || (isPermanent ? "Permanent" : null);
    }

    // Shoutouts
    case "channel.shoutout.create":
    case "channel.shoutout.receive": {
      const targetName = data.to_broadcaster_user_name as string | undefined;
      const fromName = data.from_broadcaster_user_name as string | undefined;
      return targetName || fromName || null;
    }

    // Moderator changes
    case "channel.moderator.add":
    case "channel.moderator.remove": {
      const modName = data.user_name as string | undefined;
      return modName || null;
    }

    default:
      return null;
  }

  return null;
}

/**
 * Display data extracted from an event for UI rendering
 */
export interface EventDisplayData {
  userName?: string;
  message?: string;
  amount?: string;
}

/**
 * Extract display-friendly data from event_data based on event type.
 * Returns an object with optional userName, message, and amount fields.
 */
export function getEventDisplayData(event: StreamEvent): EventDisplayData {
  const data = event.event_data as Record<string, unknown> | null;
  if (!data) return {};

  const result: EventDisplayData = {};

  // Extract user name from common fields
  const userName =
    (data.user_name as string) ||
    (data.from_broadcaster_user_name as string) ||
    (data.to_broadcaster_user_name as string) ||
    (data.chatter_user_name as string);
  if (userName) result.userName = userName;

  // Extract message from common fields
  const message = (data.message as string) || (data.user_input as string) || (data.reason as string);
  if (message) result.message = message;

  // Extract amount based on event type
  switch (event.event_type) {
    case "channel.cheer": {
      const bits = data.bits as number | undefined;
      if (bits) result.amount = `${bits} bits`;
      break;
    }
    case "channel.subscription.gift": {
      const total = data.total as number | undefined;
      if (total) result.amount = `${total} gift${total > 1 ? "s" : ""}`;
      break;
    }
    case "channel.channel_points_custom_reward_redemption.add":
    case "channel.channel_points_custom_reward_redemption.update":
    case "channel.channel_points_automatic_reward_redemption.add": {
      const reward = data.reward as { cost?: number } | undefined;
      if (reward?.cost) result.amount = `${reward.cost} points`;
      break;
    }
    case "channel.raid": {
      const viewers = data.viewers as number | undefined;
      if (viewers) result.amount = `${viewers} viewers`;
      break;
    }
  }

  return result;
}
