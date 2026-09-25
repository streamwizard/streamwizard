import { z } from "zod";
import {
  ChannelAdBreakBeginEventSchema,
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
import {
  ChannelChatClearEventSchema,
  ChannelChatClearUserMessagesEventSchema,
  ChannelChatMessageDeleteEventSchema,
  ChannelChatMessageEventSchema,
  ChannelChatNotificationEventSchema,
} from "./chat";
import { ChannelPointsCustomRewardRedemptionAddEventSchema } from "./channel-points";
import {
  ChannelGoalBeginEventSchema,
  ChannelGoalEndEventSchema,
  ChannelGoalProgressEventSchema,
  ChannelHypeTrainBeginEventSchema,
  ChannelHypeTrainEndEventSchema,
  ChannelShoutoutCreateEventSchema,
  ChannelShoutoutReceiveEventSchema,
} from "./misc";
import {
  ChannelPollBeginEventSchema,
  ChannelPollEndEventSchema,
  ChannelPollProgressEventSchema,
} from "./polls-predictions";
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
  /**
   * Alternate payloads for the same listener, keyed by variant name. Chat
   * notices need this: `channel.chat.notification` is one subscription type
   * carrying a dozen different celebrations, and each one has to be testable
   * on its own. A variant is not a separate map key on purpose -- the key is
   * the listener string, and ws-server rejects anything that isn't one.
   */
  variants?: Record<
    string,
    { label: string; build: (opts?: WidgetTestEventOptions) => Record<string, unknown> }
  >;
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

/**
 * Every notice block `channel.chat.notification` can carry, all null. Twitch
 * sends the full set on every notice with only the matching one populated, and
 * the schema requires them present -- so a fixture that spreads this and
 * overrides one key is the same shape a real notice arrives in.
 */
const EMPTY_NOTICE_BLOCKS = {
  sub: null,
  resub: null,
  sub_gift: null,
  community_sub_gift: null,
  gift_paid_upgrade: null,
  prime_paid_upgrade: null,
  pay_it_forward: null,
  raid: null,
  unraid: null,
  announcement: null,
  bits_badge_tier: null,
  charity_donation: null,
  watch_streak: null,
  modiversary: null,
} as const;

/** The gifter fields shared by pay_it_forward and gift_paid_upgrade. */
const DEMO_GIFTER = {
  gifter_is_anonymous: false,
  gifter_user_id: "9",
  gifter_user_login: "sandwichlord",
  gifter_user_name: "sandwichlord",
};

/**
 * Builds one `channel.chat.notification` payload: the chatter envelope every
 * notice shares, plus the one populated block for `noticeType`.
 */
function chatNotice(
  noticeType: string,
  blocks: Record<string, unknown>,
  systemMessage: (userName: string) => string,
  text = "",
  opts?: WidgetTestEventOptions
): Record<string, unknown> {
  const v = viewer(opts);
  return {
    ...BROADCASTER,
    chatter_user_id: v.user_id,
    chatter_user_login: v.user_login,
    chatter_user_name: v.user_name,
    chatter_is_anonymous: false,
    color: "#5CE1E6",
    badges: DEMO_BADGES,
    user_profile_image_url: v.user_profile_image_url,
    system_message: systemMessage(v.user_name),
    message_id: uuid(),
    message: {
      text,
      fragments: text ? [{ type: "text", text }] : [],
    },
    notice_type: noticeType,
    ...EMPTY_NOTICE_BLOCKS,
    ...blocks,
  };
}

/** The Creator Goal types, one demo variant each. */
const DEMO_GOAL_TYPES = {
  follow: { label: "Follower goal", description: "Road to 1,000 followers", target: 1000 },
  subscription: { label: "Sub goal (points)", description: "Sub points for the new emote", target: 500 },
  subscription_count: { label: "Sub goal (subs)", description: "Sub goal", target: 250 },
  new_subscription: { label: "New sub goal (points)", description: "New sub points this month", target: 100 },
  new_subscription_count: { label: "New sub goal (subs)", description: "New subs this stream", target: 50 },
  new_bit: { label: "Bits goal", description: "Bits for the new camera", target: 5000 },
  new_cheerer: { label: "Cheerers goal", description: "Cheerers this stream", target: 25 },
} as const;

type DemoGoalType = keyof typeof DEMO_GOAL_TYPES;
type DemoGoalStage = "begin" | "progress" | "end";

/**
 * One `channel.goal.*` payload. The id is fixed per goal type so a begin,
 * a few progress fires and an end all land on the same goal. Progress picks a
 * fresh amount each fire so the bar visibly moves.
 */
function demoGoal(type: DemoGoalType, stage: DemoGoalStage): Record<string, unknown> {
  const { description, target } = DEMO_GOAL_TYPES[type];
  const current =
    stage === "begin" ? 0 : stage === "end" ? target : Math.round(target * (0.1 + Math.random() * 0.8));
  const payload: Record<string, unknown> = {
    id: `demo-goal-${type}`,
    ...BROADCASTER,
    type,
    description,
    current_amount: current,
    target_amount: target,
    started_at: now(),
  };
  if (stage === "end") {
    payload.is_achieved = true;
    payload.ended_at = now();
  }
  return payload;
}

function demoGoalVariants(stage: DemoGoalStage) {
  return Object.fromEntries(
    (Object.keys(DEMO_GOAL_TYPES) as DemoGoalType[]).map((type) => [
      type,
      { label: DEMO_GOAL_TYPES[type].label, build: () => demoGoal(type, stage) },
    ]),
  );
}

/** The id every demo poll fire uses; widgets use it to tell test polls from real ones. */
export const DEMO_POLL_ID = "demo-poll";

const DEMO_POLL_TITLE = "Aren't shoes just hard socks?";
const DEMO_POLL_CHOICES = ["Hard socks", "Absolutely not", "Depends on the shoe"] as const;
const DEMO_POLL_SECONDS = 60;
const DEMO_POLL_VOTING = {
  bits_voting: { is_enabled: false, amount_per_vote: 0 },
  channel_points_voting: { is_enabled: true, amount_per_vote: 100 },
};

/**
 * When the demo poll started. A begin sets it; progress and end reuse it, so
 * the countdown keeps running across fires instead of restarting each time.
 */
let demoPollStartedAt = 0;

function demoPollClock() {
  const t = Date.now();
  if (t - demoPollStartedAt > DEMO_POLL_SECONDS * 1000) demoPollStartedAt = t;
  return {
    started_at: new Date(demoPollStartedAt).toISOString(),
    ends_at: new Date(demoPollStartedAt + DEMO_POLL_SECONDS * 1000).toISOString(),
  };
}

type DemoPollVotes = "random" | "close" | "final";

/**
 * One `channel.poll.*` payload. The id is fixed so begin, progress and end all
 * land on the same poll. "close" puts the first two choices a vote apart.
 */
function demoPoll(stage: "begin" | "progress" | "end", votes: DemoPollVotes = "random"): Record<string, unknown> {
  if (stage === "begin") demoPollStartedAt = Date.now();
  const clock = demoPollClock();
  const counts =
    votes === "close"
      ? [41, 40, 12]
      : votes === "final"
        ? [140, 62, 35]
        : DEMO_POLL_CHOICES.map(() => Math.round(5 + Math.random() * 60));
  const choices = DEMO_POLL_CHOICES.map((title, i) =>
    stage === "begin"
      ? { id: String(i + 1), title }
      : {
          id: String(i + 1),
          title,
          bits_votes: 0,
          channel_points_votes: Math.round(counts[i]! * 0.2),
          votes: counts[i]!,
        },
  );
  const payload: Record<string, unknown> = {
    id: DEMO_POLL_ID,
    ...BROADCASTER,
    title: DEMO_POLL_TITLE,
    choices,
    ...DEMO_POLL_VOTING,
    started_at: clock.started_at,
  };
  if (stage === "end") {
    payload.status = "completed";
    payload.ended_at = now();
  } else {
    payload.ends_at = clock.ends_at;
  }
  return payload;
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
        // Every fragment type Twitch can send, so a chat renderer exercises
        // emote, mention and cheermote handling from a single test fire.
        message: {
          text: "Hello @Broadcaster! Kappa Cheer100",
          fragments: [
            { type: "text", text: "Hello " },
            {
              type: "mention",
              text: "@Broadcaster",
              mention: { user_id: "2", user_name: "Broadcaster", user_login: "broadcaster" },
            },
            { type: "text", text: "! " },
            { type: "emote", text: "Kappa", emote: { id: "25", emote_set_id: "0" } },
            { type: "text", text: " " },
            { type: "cheermote", text: "Cheer100", cheermote: { prefix: "Cheer", bits: 100, tier: 1 } },
          ],
        },
        color: "#FF6B6B",
        badges: DEMO_BADGES,
        user_profile_image_url: v.user_profile_image_url,
        message_type: "text",
        cheer: { bits: 100 },
        reply: {
          parent_message_id: uuid(),
          parent_message_body: "What game is this?",
          parent_user_id: "2",
          parent_user_name: "Broadcaster",
          parent_user_login: "broadcaster",
          thread_message_id: uuid(),
          thread_user_id: "2",
          thread_user_name: "Broadcaster",
          thread_user_login: "broadcaster",
        },
      };
    },
    variants: {
      gif: {
        label: "Chat message (GIF)",
        build: (o?: WidgetTestEventOptions) => {
          const v = viewer(o);
          return {
            ...BROADCASTER,
            chatter_user_id: v.user_id,
            chatter_user_login: v.user_login,
            chatter_user_name: v.user_name,
            message_id: uuid(),
            // A GIF is the whole message: one fragment, `text` is its alt text.
            message: {
              text: "hype",
              fragments: [
                {
                  type: "gif",
                  text: "hype",
                  gif: { id: "3o7aCTPPm4OHfRLSH6", url: "https://media.giphy.com/media/3o7aCTPPm4OHfRLSH6/giphy.gif" },
                },
              ],
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
    },
  },
  "channel.chat.notification": {
    label: "Chat notice (resub)",
    group: "Chat",
    schema: ChannelChatNotificationEventSchema,
    build: (o?) =>
      chatNotice(
        "resub",
        {
          resub: {
            cumulative_months: 6,
            duration_months: 1,
            streak_months: 6,
            sub_plan: "1000",
            is_gift: false,
            gifter_is_anonymous: null,
            gifter_user_id: null,
            gifter_user_name: null,
            gifter_user_login: null,
          },
        },
        (n) => `${n} subscribed for 6 months in a row!`,
        "Six months, still here!",
        o
      ),
    /*
     * One variant per notice type the alert box configures. `resub` is the
     * default build above rather than a variant, so the picker's plain entry
     * stays what it always was.
     */
    variants: {
      sub: {
        label: "Chat notice (sub)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "sub",
            { sub: { sub_plan: "1000", is_gift: false } },
            (n) => `${n} subscribed with Prime!`,
            "",
            o
          ),
      },
      sub_gift: {
        label: "Chat notice (gift sub)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "sub_gift",
            {
              sub_gift: {
                duration_months: 1,
                cumulative_total: 12,
                recipient_user_id: "7",
                recipient_user_login: "ninetoad",
                recipient_user_name: "ninetoad",
                sub_plan: "1000",
                // A lone gift, not part of a bomb -- the alert box skips the
                // per-recipient notices that carry a community_gift_id.
                community_gift_id: null,
              },
            },
            (n) => `${n} gifted a sub to ninetoad!`,
            "",
            o
          ),
      },
      community_sub_gift: {
        label: "Chat notice (gift bomb)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "community_sub_gift",
            {
              community_sub_gift: {
                id: uuid(),
                total: 5,
                sub_plan: "1000",
                cumulative_total: 20,
              },
            },
            (n) => `${n} is gifting 5 subs to the community!`,
            "",
            o
          ),
      },
      gift_paid_upgrade: {
        label: "Chat notice (gift upgrade)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "gift_paid_upgrade",
            { gift_paid_upgrade: { ...DEMO_GIFTER } },
            (n) => `${n} is continuing their gift sub!`,
            "",
            o
          ),
      },
      prime_paid_upgrade: {
        label: "Chat notice (Prime upgrade)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "prime_paid_upgrade",
            { prime_paid_upgrade: { sub_plan: "1000" } },
            (n) => `${n} converted their Prime sub to Tier 1!`,
            "",
            o
          ),
      },
      pay_it_forward: {
        label: "Chat notice (pay it forward)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "pay_it_forward",
            { pay_it_forward: { ...DEMO_GIFTER } },
            (n) => `${n} is paying forward a gift sub!`,
            "",
            o
          ),
      },
      raid: {
        label: "Chat notice (raid)",
        build: (o?: WidgetTestEventOptions) => {
          const v = viewer(o);
          return chatNotice(
            "raid",
            {
              raid: {
                user_id: v.user_id,
                user_login: v.user_login,
                user_name: v.user_name,
                viewer_count: 42,
                profile_image_url: v.user_profile_image_url,
              },
            },
            (n) => `${n} is raiding with 42 viewers!`,
            "",
            o
          );
        },
      },
      announcement: {
        label: "Chat notice (announcement)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "announcement",
            { announcement: { color: "PRIMARY" } },
            (n) => `${n} made an announcement`,
            "Clip contest ends at midnight",
            o
          ),
      },
      bits_badge_tier: {
        label: "Chat notice (bits badge)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "bits_badge_tier",
            { bits_badge_tier: { tier: 10000 } },
            (n) => `${n} just earned the 10000 bits badge!`,
            "",
            o
          ),
      },
      charity_donation: {
        label: "Chat notice (charity donation)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "charity_donation",
            {
              charity_donation: {
                charity_name: "Cats With Hats",
                // 2500 minor units at 2 decimal places = $25.00.
                amount: { value: 2500, decimal_places: 2, currency: "USD" },
              },
            },
            (n) => `${n} donated $25.00 to Cats With Hats!`,
            "For the cause, and the hydration",
            o
          ),
      },
      watch_streak: {
        label: "Chat notice (watch streak)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "watch_streak",
            { watch_streak: { consecutive_months: 5 } },
            (n) => `${n} is on a 5 stream watch streak!`,
            "",
            o
          ),
      },
      modiversary: {
        label: "Chat notice (modiversary)",
        build: (o?: WidgetTestEventOptions) =>
          chatNotice(
            "modiversary",
            // Twitch documents the notice type but no payload object for it,
            // so there is nothing to populate -- and no year to read back.
            {},
            (n) => `${n} is celebrating their modiversary!`,
            "",
            o
          ),
      },
    },
  },
  "channel.chat.message_delete": {
    label: "Message deleted",
    group: "Chat",
    schema: ChannelChatMessageDeleteEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        ...BROADCASTER,
        target_user_id: v.user_id,
        target_user_login: v.user_login,
        target_user_name: v.user_name,
        // A live delete names an existing message; a fixture can't, so a
        // renderer that finds no match should simply do nothing.
        message_id: uuid(),
      };
    },
  },
  "channel.chat.clear_user_messages": {
    label: "User timed out",
    group: "Chat",
    schema: ChannelChatClearUserMessagesEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        broadcaster_user_id: BROADCASTER.broadcaster_user_id,
        broadcaster_user_login: BROADCASTER.broadcaster_user_login,
        broadcaster_user_name: BROADCASTER.broadcaster_user_name,
        target_user_id: v.user_id,
        target_user_login: v.user_login,
        target_user_name: v.user_name,
      };
    },
  },
  "channel.shoutout.receive": {
    label: "Shoutout received",
    group: "Channel",
    schema: ChannelShoutoutReceiveEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        broadcaster_user_id: BROADCASTER.broadcaster_user_id,
        broadcaster_user_login: BROADCASTER.broadcaster_user_login,
        broadcaster_user_name: BROADCASTER.broadcaster_user_name,
        from_broadcaster_user_id: v.user_id,
        from_broadcaster_user_login: v.user_login,
        from_broadcaster_user_name: v.user_name,
        viewer_count: 128,
        started_at: now(),
      };
    },
  },
  "channel.shoutout.create": {
    label: "Shoutout sent",
    group: "Channel",
    schema: ChannelShoutoutCreateEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        ...BROADCASTER,
        moderator_user_id: BROADCASTER.broadcaster_user_id,
        moderator_user_login: BROADCASTER.broadcaster_user_login,
        moderator_user_name: BROADCASTER.broadcaster_user_name,
        to_broadcaster_user_id: v.user_id,
        to_broadcaster_user_login: v.user_login,
        to_broadcaster_user_name: v.user_name,
        started_at: now(),
        viewer_count: 128,
        cooldown_ends_at: now(),
        target_cooldown_ends_at: now(),
      };
    },
  },
  "channel.hype_train.begin": {
    label: "Hype train started",
    group: "Channel",
    schema: ChannelHypeTrainBeginEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        id: uuid(),
        ...BROADCASTER,
        total: 1200,
        top_contributions: [
          {
            user_id: v.user_id,
            user_login: v.user_login,
            user_name: v.user_name,
            type: "bits",
            total: 1200,
          },
        ],
        shared_train_participants: null,
        level: 1,
        started_at: now(),
        is_shared_train: false,
        type: "regular",
        progress: 200,
        goal: 1600,
        expires_at: now(),
      };
    },
  },
  "channel.hype_train.end": {
    label: "Hype train ended",
    group: "Channel",
    schema: ChannelHypeTrainEndEventSchema,
    build: (o?) => {
      const v = viewer(o);
      return {
        id: uuid(),
        ...BROADCASTER,
        total: 9400,
        top_contributions: [
          {
            user_id: v.user_id,
            user_login: v.user_login,
            user_name: v.user_name,
            type: "bits",
            total: 4200,
          },
        ],
        shared_train_participants: null,
        level: 4,
        started_at: now(),
        is_shared_train: false,
        type: "regular",
        ended_at: now(),
        cooldown_ends_at: now(),
      };
    },
  },
  "channel.goal.begin": {
    label: "Goal started",
    group: "Channel",
    schema: ChannelGoalBeginEventSchema,
    build: () => demoGoal("follow", "begin"),
    variants: demoGoalVariants("begin"),
  },
  "channel.goal.progress": {
    label: "Goal progress",
    group: "Channel",
    schema: ChannelGoalProgressEventSchema,
    build: () => demoGoal("follow", "progress"),
    variants: demoGoalVariants("progress"),
  },
  "channel.goal.end": {
    label: "Goal reached",
    group: "Channel",
    schema: ChannelGoalEndEventSchema,
    build: () => demoGoal("follow", "end"),
    variants: demoGoalVariants("end"),
  },
  "channel.ad_break.begin": {
    label: "Ad break",
    group: "Channel",
    schema: ChannelAdBreakBeginEventSchema,
    // `demo` is ours, not Twitch's: the ad break has no id of its own, so this
    // is how the ad widget tells a test break from a real one.
    build: () => ({
      demo: true,
      duration_seconds: 60,
      is_automatic: true,
      started_at: now(),
      ...BROADCASTER,
      requester_user_id: BROADCASTER.broadcaster_user_id,
      requester_user_login: BROADCASTER.broadcaster_user_login,
      requester_user_name: BROADCASTER.broadcaster_user_name,
    }),
  },
  "channel.poll.begin": {
    label: "Poll started",
    group: "Channel",
    schema: ChannelPollBeginEventSchema,
    build: () => demoPoll("begin"),
  },
  "channel.poll.progress": {
    label: "Poll votes",
    group: "Channel",
    schema: ChannelPollProgressEventSchema,
    build: () => demoPoll("progress"),
    variants: {
      close: { label: "Close race", build: () => demoPoll("progress", "close") },
    },
  },
  "channel.poll.end": {
    label: "Poll ended",
    group: "Channel",
    schema: ChannelPollEndEventSchema,
    build: () => demoPoll("end", "final"),
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

/**
 * Builds a `{type, payload}` socket message for one test event. `variant`
 * picks an alternate payload for the same listener -- which chat notice to
 * send, for instance.
 */
export function buildWidgetTestEvent(
  type: WidgetTestEventType,
  opts?: WidgetTestEventOptions,
  variant?: string
): { type: WidgetTestEventType; payload: Record<string, unknown> } {
  const def: WidgetTestEventDef = WIDGET_TEST_EVENTS[type];
  const build = variant ? def.variants?.[variant]?.build : def.build;
  if (!build) {
    throw new Error(`Unknown variant "${variant}" for test event "${type}"`);
  }
  return { type, payload: build(opts) };
}
