import { z } from "zod";
import {
  ChannelBanEventSchema,
  ChannelCheerEventSchema,
  ChannelFollowEventSchema,
  ChannelRaidEventSchema,
  ChannelSubscribeEventSchema,
  ChannelSubscriptionEndEventSchema,
  ChannelSubscriptionGiftEventSchema,
  ChannelSubscriptionMessageEventSchema,
  ChannelUpdateEventSchema,
} from "./channel";
import { ChannelChatClearEventSchema, ChannelChatMessageEventSchema } from "./chat";
import { ChannelPointsCustomRewardRedemptionAddEventSchema } from "./channel-points";
import { StreamOfflineEventSchema, StreamOnlineEventSchema } from "./stream";

/**
 * Canonical synthetic EventSub payloads, used everywhere a StreamWizard surface
 * needs to fake an event: the widget editor's test buttons, the overlay
 * editor's alert previews, and the docs. Keeping one source is what stops the
 * fixtures from drifting apart -- and pairing each with the zod schema it must
 * satisfy is what stops them from drifting away from Twitch (see the test).
 *
 * `build` is a thunk, not a literal, so timestamps and ids are fresh on every
 * fire rather than frozen at module load.
 */
export interface WidgetTestEventOptions {
  /** Display name of the fake viewer. Login is derived from it. */
  userName?: string;
}

export interface WidgetTestEventDef {
  /** Human label for buttons and pickers. */
  label: string;
  /** Grouping for the picker. */
  group: "Channel" | "Chat" | "Channel points" | "Stream";
  /** The zod schema the built payload must satisfy. */
  schema: z.ZodType;
  build: (opts?: WidgetTestEventOptions) => Record<string, unknown>;
}

const DEFAULT_USER_NAME = "TestUser";

const BROADCASTER = {
  broadcaster_user_id: "2",
  broadcaster_user_login: "broadcaster",
  broadcaster_user_name: "Broadcaster",
};

/**
 * Twitch's own default avatar. Real URL on the real CDN, so a widget that
 * renders `user_profile_image_url` in the editor sees exactly what it will see
 * live -- including the load behaviour of an actual remote image.
 */
const DEFAULT_PROFILE_IMAGE_URL =
  "https://static-cdn.jtvnw.net/user-default-pictures-uv/294c98b5-e34d-42cd-a8f0-140b72fba9b0-profile_image-300x300.png";

/**
 * Real global badge artwork, in the shape StreamWizard adds before dispatch:
 * the EventSub fields plus the resolved URLs. `url` is the StreamElements
 * alias for url_2x. A live event omits these until the badge cache is warm, so
 * widgets must still guard -- but the demo shows the enriched shape because
 * that is what authors will see nearly all of the time.
 */
const DEMO_BADGES = [
  {
    set_id: "moderator",
    id: "1",
    info: "",
    url: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2",
    url_1x: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/1",
    url_2x: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/2",
    url_4x: "https://static-cdn.jtvnw.net/badges/v1/3267646d-33f0-4b17-b3df-f923a41db1d0/3",
  },
  {
    set_id: "subscriber",
    id: "0",
    info: "14",
    url: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/2",
    url_1x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/1",
    url_2x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/2",
    url_4x: "https://static-cdn.jtvnw.net/badges/v1/5d9f2208-5dd8-11e7-8513-2ff4adfae661/3",
  },
];

function viewer(opts?: WidgetTestEventOptions) {
  const userName = opts?.userName ?? DEFAULT_USER_NAME;
  return {
    user_id: "1",
    user_login: userName.toLowerCase(),
    user_name: userName,
    // Added by StreamWizard, not by Twitch -- see EnrichedUserProfileSchema.
    user_profile_image_url: DEFAULT_PROFILE_IMAGE_URL,
  };
}

/** Stable in environments without crypto.randomUUID (older Safari, some SSR paths). */
function uuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `test-${Math.random().toString(36).slice(2)}`;
}

function now(): string {
  return new Date().toISOString();
}

export const WIDGET_TEST_EVENTS = {
  "channel.follow": {
    label: "Follow",
    group: "Channel",
    schema: ChannelFollowEventSchema,
    build: (o?) => ({ ...viewer(o), ...BROADCASTER, followed_at: now() }),
  },
  "channel.subscribe": {
    label: "Sub",
    group: "Channel",
    schema: ChannelSubscribeEventSchema,
    build: (o?) => ({ ...viewer(o), ...BROADCASTER, tier: "1000", is_gift: false }),
  },
  "channel.subscription.gift": {
    label: "Gift sub",
    group: "Channel",
    schema: ChannelSubscriptionGiftEventSchema,
    build: (o?) => ({
      ...viewer(o),
      ...BROADCASTER,
      total: 5,
      tier: "1000",
      cumulative_total: 5,
      is_anonymous: false,
    }),
  },
  "channel.subscription.message": {
    label: "Resub",
    group: "Channel",
    schema: ChannelSubscriptionMessageEventSchema,
    build: (o?) => ({
      ...viewer(o),
      ...BROADCASTER,
      tier: "1000",
      message: { text: "Love the stream!", emotes: [] },
      cumulative_months: 6,
      streak_months: 6,
      duration_months: 1,
    }),
  },
  "channel.subscription.end": {
    label: "Sub ended",
    group: "Channel",
    schema: ChannelSubscriptionEndEventSchema,
    build: (o?) => ({ ...viewer(o), ...BROADCASTER, tier: "1000", is_gift: false }),
  },
  "channel.cheer": {
    label: "Cheer",
    group: "Channel",
    schema: ChannelCheerEventSchema,
    build: (o?) => ({
      is_anonymous: false,
      ...viewer(o),
      ...BROADCASTER,
      message: "Take my bits!",
      bits: 500,
    }),
  },
  "channel.raid": {
    label: "Raid",
    group: "Channel",
    schema: ChannelRaidEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        from_broadcaster_user_id: v.user_id,
        from_broadcaster_user_login: v.user_login,
        from_broadcaster_user_name: v.user_name,
        user_profile_image_url: v.user_profile_image_url,
        to_broadcaster_user_id: BROADCASTER.broadcaster_user_id,
        to_broadcaster_user_login: BROADCASTER.broadcaster_user_login,
        to_broadcaster_user_name: BROADCASTER.broadcaster_user_name,
        viewers: 42,
      };
    },
  },
  "channel.update": {
    label: "Channel update",
    group: "Channel",
    schema: ChannelUpdateEventSchema,
    build: () => ({
      ...BROADCASTER,
      title: "Testing StreamWizard widgets",
      language: "en",
      category_id: "509658",
      category_name: "Just Chatting",
      content_classification_labels: [],
    }),
  },
  "channel.ban": {
    label: "Ban",
    group: "Channel",
    schema: ChannelBanEventSchema,
    build: (o?) => ({
      ...viewer(o),
      ...BROADCASTER,
      moderator_user_id: "3",
      moderator_user_login: "mod",
      moderator_user_name: "Mod",
      reason: "Testing",
      banned_at: now(),
      ends_at: null,
      is_permanent: true,
    }),
  },
  "channel.chat.message": {
    label: "Chat message",
    group: "Chat",
    schema: ChannelChatMessageEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        ...BROADCASTER,
        chatter_user_id: v.user_id,
        chatter_user_login: v.user_login,
        chatter_user_name: v.user_name,
        message_id: uuid(),
        message: {
          text: "Hello streamer!",
          fragments: [{ type: "text", text: "Hello streamer!" }],
        },
        color: "#FF6B6B",
        badges: DEMO_BADGES,
        user_profile_image_url: v.user_profile_image_url,
        message_type: "text",
        cheer: null,
        reply: null,
      };
    },
  },
  "channel.chat.clear": {
    label: "Chat cleared",
    group: "Chat",
    schema: ChannelChatClearEventSchema,
    build: () => ({
      broadcaster_user_id: "2",
      broadcaster_user_login: "broadcaster",
      broadcaster_user_name: "Broadcaster",
    }),
  },
  "channel.channel_points_custom_reward_redemption.add": {
    label: "Reward redeemed",
    group: "Channel points",
    schema: ChannelPointsCustomRewardRedemptionAddEventSchema,
    build: (o?) => ({
      id: uuid(),
      ...BROADCASTER,
      ...viewer(o),
      user_input: "Hello!",
      status: "unfulfilled",
      reward: { id: uuid(), title: "Test Reward", cost: 500, prompt: "" },
      redeemed_at: now(),
    }),
  },
  "stream.online": {
    label: "Stream online",
    group: "Stream",
    schema: StreamOnlineEventSchema,
    build: () => ({
      id: uuid(),
      ...BROADCASTER,
      type: "live",
      started_at: now(),
    }),
  },
  "stream.offline": {
    label: "Stream offline",
    group: "Stream",
    schema: StreamOfflineEventSchema,
    build: () => ({
      broadcaster_user_id: "2",
      broadcaster_user_login: "broadcaster",
      broadcaster_user_name: "Broadcaster",
    }),
  },
} as const satisfies Record<string, WidgetTestEventDef>;

export type WidgetTestEventType = keyof typeof WIDGET_TEST_EVENTS;

export const WIDGET_TEST_EVENT_TYPES = Object.keys(
  WIDGET_TEST_EVENTS
) as WidgetTestEventType[];

/**
 * Doubles as the allowlist for the server action that broadcasts a test event
 * into a live room -- never let a client-supplied event type through unchecked.
 */
export function isWidgetTestEventType(value: string): value is WidgetTestEventType {
  return Object.prototype.hasOwnProperty.call(WIDGET_TEST_EVENTS, value);
}

/** Builds a `{type, payload}` socket message for one test event. */
export function buildWidgetTestEvent(
  type: WidgetTestEventType,
  opts?: WidgetTestEventOptions
): { type: WidgetTestEventType; payload: Record<string, unknown> } {
  return { type, payload: WIDGET_TEST_EVENTS[type].build(opts) };
}
