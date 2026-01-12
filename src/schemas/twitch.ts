import { z } from "zod";

export const channel_follow_schema = z.object({
    user_id: z.string(),
    user_login: z.string(),
    user_name: z.string(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    followed_at: z.string(),
});

export type ChannelFollow = z.infer<typeof channel_follow_schema>;

export const channel_subscribe_schema = z.object({
    user_id: z.string(),
    user_login: z.string(),
    user_name: z.string(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    tier: z.string(),
    is_gift: z.boolean(),
});


export type ChannelSubscribe = z.infer<typeof channel_subscribe_schema>;

export const channel_subscription_gift_schema = z.object({
    user_id: z.string(),
    user_login: z.string(),
    user_name: z.string(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    total: z.number(),
    tier: z.string(),
    cumulative_total: z.number().nullable(),
    is_anonymous: z.boolean(),
});

export type ChannelSubscriptionGift = z.infer<typeof channel_subscription_gift_schema>;


const message_emote_schema = z.object({
    begin: z.number(),
    end: z.number(),
    id: z.string(),
});

const message_schema = z.object({
    text: z.string(),
    emotes: z.array(message_emote_schema),
});

export const channel_subscription_message_schema = z.object({
    user_id: z.string(),
    user_login: z.string(),
    user_name: z.string(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    tier: z.string(),
    message: message_schema,
    cumulative_months: z.number(),
    streak_months: z.number().nullable(),
    duration_months: z.number(),
});

export type ChannelSubscriptionMessage = z.infer<typeof channel_subscription_message_schema>;



export const channel_raid_schema = z.object({
    from_broadcaster_user_id: z.string(),
    from_broadcaster_user_login: z.string(),
    from_broadcaster_user_name: z.string(),
    to_broadcaster_user_id: z.string(),
    to_broadcaster_user_login: z.string(),
    to_broadcaster_user_name: z.string(),
    viewers: z.number(),
});

export type ChannelRaid = z.infer<typeof channel_raid_schema>;


export const channel_cheer_schema = z.object({
    is_anonymous: z.boolean(),
    user_id: z.string().nullable(),
    user_login: z.string().nullable(),
    user_name: z.string().nullable(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    message: z.string(),
    bits: z.number(),
});

export type ChannelCheer = z.infer<typeof channel_cheer_schema>;


const reward_schema = z.object({
    id: z.string(),
    title: z.string(),
    cost: z.number(),
    prompt: z.string().nullable(),
});

export const channel_points_custom_reward_redemption_add_schema = z.object({
    id: z.string(),
    broadcaster_user_id: z.string(),
    broadcaster_user_login: z.string(),
    broadcaster_user_name: z.string(),
    user_id: z.string(),
    user_login: z.string(),
    user_name: z.string(),
    user_input: z.string(),
    status: z.string(),
    reward: reward_schema,
    redeemed_at: z.string(),
});

export type ChannelPointsCustomRewardRedemptionAdd = z.infer<typeof channel_points_custom_reward_redemption_add_schema>;



