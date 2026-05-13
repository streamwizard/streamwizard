import {
  UserPlus,
  Star,
  Gem,
  Swords,
  Circle,
  Pencil,
  Radio,
  WifiOff,
  Tv,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type FilterGroup = "follows" | "subs" | "bits" | "raids" | "rewards" | "updates";

export interface EventConfig {
  icon: LucideIcon;
  color: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  label: (d: any) => string;
  filterGroup: FilterGroup;
  isDivider?: boolean;
}

export const EVENT_CONFIG: Record<string, EventConfig> = {
  "channel.follow": {
    icon: UserPlus,
    color: "text-green-400",
    label: (d) => `${d?.user_name ?? "Someone"} followed`,
    filterGroup: "follows",
  },
  "channel.subscribe": {
    icon: Star,
    color: "text-yellow-400",
    label: (d) =>
      `${d?.user_name ?? "Someone"} subscribed · Tier ${(d?.tier ?? "1000")[0]}${d?.is_gift ? " (gifted)" : ""}`,
    filterGroup: "subs",
  },
  "channel.subscription.message": {
    icon: Star,
    color: "text-yellow-400",
    label: (d) =>
      `${d?.user_name ?? "Someone"} resubscribed · ${d?.message?.text ?? ""}`,
    filterGroup: "subs",
  },
  "channel.cheer": {
    icon: Gem,
    color: "text-purple-400",
    label: (d) => `${d?.user_name ?? "Someone"} cheered ${d?.bits ?? 0} bits`,
    filterGroup: "bits",
  },
  "channel.raid": {
    icon: Swords,
    color: "text-orange-400",
    label: (d) =>
      `${d?.from_broadcaster_user_name ?? "Someone"} raided with ${d?.viewers ?? 0} viewers`,
    filterGroup: "raids",
  },
  "channel.channel_points_custom_reward_redemption.add": {
    icon: Circle,
    color: "text-[#6441a5]",
    label: (d) =>
      `${d?.user_name ?? "Someone"} redeemed ${d?.reward?.title ?? "reward"} (${d?.reward?.cost ?? 0} pts)`,
    filterGroup: "rewards",
  },
  "channel.update": {
    icon: Pencil,
    color: "text-muted-foreground",
    label: (d) => `Updated to ${d?.category_name ?? "unknown"} · "${d?.title ?? ""}"`,
    filterGroup: "updates",
  },
  "stream.online": {
    icon: Radio,
    color: "text-green-400",
    label: () => "Stream started",
    filterGroup: "updates",
    isDivider: true,
  },
  "stream.offline": {
    icon: WifiOff,
    color: "text-red-400",
    label: () => "Stream ended",
    filterGroup: "updates",
    isDivider: true,
  },
  "channel.ad_break.begin": {
    icon: Tv,
    color: "text-muted-foreground",
    label: (d) =>
      `Ad break · ${d?.duration_seconds ?? 0}s (${d?.is_automatic ? "automatic" : "manual"})`,
    filterGroup: "updates",
  },
};
